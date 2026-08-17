import * as db from '../db';
import { scanSecrets } from './secretScanner';
import { scanCompliance } from './complianceAgent';
import { generateRemediation } from './remediationAgent';
import { runRoundRobinEvaluation } from './roundRobinValidator';

export interface RunScanOptions {
  prNumber: number;
  repoName: string;
  author: string;
  title: string;
  diff: string;
}

export async function executeAuditPipeline(options: RunScanOptions) {
  const { prNumber, repoName, author, title, diff } = options;

  console.log(`🚀 Starting Heimdall AI Orchestrator for PR #${prNumber} in ${repoName}...`);

  // 1. Create or insert PR transaction record in CockroachDB
  const prInsertion = await db.query(
    `INSERT INTO prs (pr_number, repo_name, status, author, title) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [prNumber, repoName, 'Pending', author, title]
  );
  
  const prId = prInsertion.rows[0].id;
  console.log(`[Orchestrator] Created PR row: ID = ${prId}`);

  // 2. Run core security analysis agents in parallel
  const [secretsResult, complianceResult] = await Promise.all([
    scanSecrets(prId, repoName, diff),
    scanCompliance(prId, repoName, diff)
  ]);

  let finalStatus = 'Passed';
  const failedRules: string[] = [];

  // Check secret scanner outcome
  if (secretsResult.status === 'Failure') {
    finalStatus = 'Failed';
    failedRules.push('no_secrets');
  } else if (secretsResult.status === 'Warning') {
    finalStatus = 'Failed';
    failedRules.push('no_secrets');
  }

  // Check compliance auditor outcome
  if (complianceResult.status === 'Failure') {
    finalStatus = 'Failed';
    // Deduce failed rules from logs
    if (complianceResult.logMessage.includes('no_sql_injection')) failedRules.push('no_sql_injection');
    if (complianceResult.logMessage.includes('secure_cors')) failedRules.push('secure_cors');
    if (complianceResult.logMessage.includes('no_deprecated_crypto')) failedRules.push('no_deprecated_crypto');
    if (failedRules.length === 0) {
      failedRules.push('compliance_policy_violation');
    }
  }

  // 3. Trigger Round Robin False Positive Triage if findings exist
  if (finalStatus === 'Failed') {
    console.log(`[Orchestrator] Findings detected. Triggering Round Robin False Positive Triage...`);
    const debateResult = await runRoundRobinEvaluation(prId, diff, failedRules);
    
    if (debateResult.isFalsePositive) {
      console.log(`[Orchestrator] Tournament classified findings as FALSE POSITIVE. Exempting PR...`);
      finalStatus = 'Passed';
    } else {
      console.log(`[Orchestrator] Tournament validated findings as TRUE POSITIVE. Dispatching RemediationAgent...`);
      await generateRemediation(prId, repoName, diff, failedRules);
    }
  }

  // 4. Update PR table with final audit state
  await db.query(
    `UPDATE prs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [finalStatus, prId]
  );

  console.log(`🏛️ Heimdall AI audit complete for PR #${prNumber}. Final Status: ${finalStatus}`);

  // 5. Query and return all audit logs for this run
  const logsResult = await db.query(
    `SELECT agent_name, status, log_message, severity, created_at FROM audit_logs WHERE pr_id = $1 ORDER BY created_at ASC`,
    [prId]
  );

  return {
    prId,
    prNumber,
    repoName,
    status: finalStatus,
    logs: logsResult.rows
  };
}
