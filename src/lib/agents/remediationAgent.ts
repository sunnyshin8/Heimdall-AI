import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import * as db from '../db';
import { AgentResult } from './secretScanner';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function generateRemediation(
  prId: string,
  repoName: string,
  diff: string,
  failedRules: string[]
): Promise<AgentResult> {
  console.log(`[RemediationAgent] Generating corrective patches for ${failedRules.join(', ')}...`);

  let suggestedFix = '';

  // 1. AWS Bedrock Generation if credentials are present
  const hasAws = process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_ACCESS_KEY_ID.includes('your-');

  if (hasAws) {
    try {
      const client = new BedrockRuntimeClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
        }
      });

      const prompt = `You are an automated remediation agent. Analyze the following code diff that failed security/compliance policies: [${failedRules.join(', ')}].
Provide a code patch (Git diff or replacement code block) that resolves these vulnerabilities. Explain what was fixed.

Code Diff:
${diff}

Respond ONLY in the following JSON format:
{
  "codeFix": "the corrected code block",
  "explanation": "Brief description of the fix"
}`;

      const command = new InvokeModelCommand({
        modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const response = await client.send(command);
      const resBody = JSON.parse(new TextDecoder().decode(response.body));
      const responseText = resBody.content[0].text;
      
      const parsed = JSON.parse(responseText.substring(responseText.indexOf('{'), responseText.lastIndexOf('}') + 1));
      suggestedFix = `PROPOSED FIX:\n${parsed.codeFix}\n\nREASON: ${parsed.explanation}`;
    } catch (err) {
      console.warn('âš ï¸ Bedrock remediation agent failed. Generating static mock correction text instead.', err);
    }
  }

  // 2. Rule-based static patch generator fallback
  if (!suggestedFix) {
    let fixesList: string[] = [];

    if (failedRules.includes('no_secrets')) {
      fixesList.push(`- Remove hardcoded credentials. Import config variables using: "process.env.AWS_ACCESS_KEY_ID" or "process.env.SECRET_TOKEN".`);
    }
    if (failedRules.includes('no_sql_injection')) {
      fixesList.push(`- Replace string concatenation in query structures with prepared placeholders, e.g.:
  Change: db.query("SELECT * FROM users WHERE name = '" + name + "'")
  To: db.query("SELECT * FROM users WHERE name = $1", [name])`);
    }
    if (failedRules.includes('secure_cors')) {
      fixesList.push(`- In network headers, change "Access-Control-Allow-Origin: *" to specific domains like "https://app.trusteddomain.com".`);
    }
    if (failedRules.includes('no_deprecated_crypto')) {
      fixesList.push(`- Swap MD5 or SHA1 crypto hashing with bcrypt:
  Change: crypto.createHash('md5').update(password).digest('hex')
  To: await bcrypt.hash(password, 10)`);
    }

    suggestedFix = `AUTO REMEDIATION SUGGESTIONS:\n${fixesList.join('\n')}\n\n(Tip: Configure AWS Bedrock credentials in .env to receive automated generative code diff patches).`;
  }

  // 3. Run the suggested fix through the AST/Hallucination validator
  const { validateRemediation } = require('./validator');
  let validation = validateRemediation(suggestedFix);

  // Auto-Remediation CI Validation (Dry-run syntax check)
  if (validation.isValid && suggestedFix.includes('PROPOSED FIX')) {
    try {
      // Extract code block
      const codeMatch = suggestedFix.match(/PROPOSED FIX:\n([\s\S]*)\n\nREASON:/);
      if (codeMatch && codeMatch[1]) {
        const scratchDir = path.join(process.cwd(), 'scratch');
        if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir);
        const tmpFile = path.join(scratchDir, patch_.js);
        fs.writeFileSync(tmpFile, codeMatch[1]);
        
        try {
          execSync(
ode -c  + tmpFile, { stdio: 'pipe' });
        } catch (e: any) {
          validation.isValid = false;
          validation.errors.push("CI Dry Run Syntax Error: " + (e.stderr?.toString() || e.message));
        } finally {
          if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        }
      }
    } catch (e) {
      console.warn('Dry run check failed', e);
    }
  }

  let result: AgentResult;

  if (!validation.isValid) {
    console.warn(`âš ï¸ [RemediationAgent] AI suggestion rejected by local validator: ${validation.errors.join(', ')}`);
    result = {
      status: 'Failure',
      logMessage: `âŒ AI REMEDIATION REJECTED (Hallucination/Syntax Check Failed):\n${validation.errors.map((e: string) => `- ${e}`).join('\n')}\n\n---\nRaw Output Received:\n${suggestedFix}`,
      severity: 'High'
    };
  } else {
    result = {
      status: 'Success',
      logMessage: suggestedFix,
      severity: 'Medium'
    };
  }

  await logAgentAudit(prId, result);
  return result;
}

async function logAgentAudit(prId: string, result: AgentResult) {
  await db.query(
    `INSERT INTO audit_logs (pr_id, agent_name, status, log_message, severity) VALUES ($1, $2, $3, $4, $5)`,
    [prId, 'RemediationAgent', result.status, result.logMessage, result.severity]
  );
}
