import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import * as db from '../db';
import { AgentResult } from './secretScanner';

export async function scanCompliance(prId: string, repoName: string, diff: string): Promise<AgentResult> {
  console.log(`[ComplianceAuditor] Auditing compliance against CockroachDB policy repository...`);

  // 1. Generate text embedding vector of code diff change (RAG pipeline)
  const { getEmbedding } = require('./embeddings');
  const diffVector = await getEmbedding(diff);

  // 2. Perform Cosine Distance Nearest Neighbors Vector Search
  // Query nearest policies matching the diff content from CockroachDB using vector operators
  const policiesResult = await db.query(
    'SELECT rule_name, category, policy_description, keywords FROM vector_policies ORDER BY embedding <=> $1 LIMIT 3',
    [diffVector]
  );
  const policies = policiesResult.rows;

  let failedRules: string[] = [];
  let warningRules: string[] = [];

  // 2. Perform static matching as a baseline
  for (const policy of policies) {
    if (policy.rule_name === 'no_sql_injection') {
      const hasSqlKeywords = /select|insert|update|delete|where/i.test(diff);
      const hasConcat = /(\+\s*['"`]\s*\w+)|(\$\{\s*\w+\s*\}.*(select|insert|update|delete))/i.test(diff);
      if (hasSqlKeywords && hasConcat) {
        failedRules.push('no_sql_injection');
      }
    }

    if (policy.rule_name === 'secure_cors') {
      if (/access-control-allow-origin.*['"`]\*['"`]/i.test(diff)) {
        failedRules.push('secure_cors');
      }
    }

    if (policy.rule_name === 'no_deprecated_crypto') {
      if (/crypto\.createHash\(\s*['"`](md5|sha1)['"`]\s*\)/i.test(diff) || /createHash\(['"`](md5|sha1)['"`]\)/i.test(diff)) {
        failedRules.push('no_deprecated_crypto');
      }
    }
  }

  // 3. Optional AWS Bedrock Verification
  const hasAws = process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_ACCESS_KEY_ID.includes('your-');
  let aiLog = '';

  if (hasAws && policies.length > 0) {
    try {
      const client = new BedrockRuntimeClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
        }
      });

      const policyDocs = policies.map((p: any) => `-[${p.rule_name}] (${p.category}): ${p.policy_description}`).join('\n');
      const prompt = `You are a compliance agent. Audit the following code diff against these active database security policies:
${policyDocs}

Code Diff:
${diff}

Respond in the following JSON format:
{
  "complies": false/true,
  "failedRules": ["rule_name"],
  "details": "Explanation of audit findings"
}`;

      const command = new InvokeModelCommand({
        modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const response = await client.send(command);
      const resBody = JSON.parse(new TextDecoder().decode(response.body));
      const responseText = resBody.content[0].text;
      
      const parsed = JSON.parse(responseText.substring(responseText.indexOf('{'), responseText.lastIndexOf('}') + 1));
      if (!parsed.complies) {
        failedRules = Array.from(new Set([...failedRules, ...parsed.failedRules]));
        aiLog = ` AI Review: ${parsed.details}`;
      }
    } catch (err) {
      console.warn('⚠️ Bedrock compliance auditor failed or timed out. Relying on baseline static filters.', err);
    }
  }

  let result: AgentResult;

  if (failedRules.length > 0) {
    const rulesText = failedRules.join(', ');
    result = {
      status: 'Failure',
      logMessage: `COMPLIANCE FAILURE: Failed database policy checks for rules: [${rulesText}].${aiLog ? aiLog : ' Potential raw SQL parameters concat or wildcard CORS origin headers detected.'}`,
      severity: 'High'
    };
  } else {
    result = {
      status: 'Success',
      logMessage: 'Compliance checks passed. Code complies fully with organizational security schemas.',
      severity: 'Info'
    };
  }

  await logAgentAudit(prId, result);
  return result;
}

async function logAgentAudit(prId: string, result: AgentResult) {
  await db.query(
    `INSERT INTO audit_logs (pr_id, agent_name, status, log_message, severity) VALUES ($1, $2, $3, $4, $5)`,
    [prId, 'ComplianceAuditor', result.status, result.logMessage, result.severity]
  );
}
