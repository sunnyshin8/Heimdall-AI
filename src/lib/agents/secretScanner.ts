import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import * as db from '../db';

// Regex scanners for quick filtering
const SECRET_REGEXES = {
  slack_webhook: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9_]{8}\/B[A-Z0-9_]{8}\/[A-Za-z0-9_]{24}/i,
  aws_key: /([^A-Z0-9]|^)(AKIA|ASCA|AOIS)[A-Z0-9]{16}([^A-Z0-9]|$)/,
  generic_secret: /(password|secret|api_key|private_key|token|auth)\s*[:=]\s*['"`][a-zA-Z0-9_\-+=/]{16,}['"`]/i,
  db_connection: /postgres(ql)?:\/\/[\w\-+]+:[\w\-+]+@[\w\-.:]+(:\d+)?\/[\w\-+]+/i
};

export interface AgentResult {
  status: 'Success' | 'Warning' | 'Failure';
  logMessage: string;
  severity: 'Info' | 'Low' | 'Medium' | 'High' | 'Critical';
}

export async function scanSecrets(prId: string, repoName: string, diff: string): Promise<AgentResult> {
  console.log(`[SecretScanner] Scanning changes in ${repoName}...`);

  let detectedSecretType = '';
  let matchedSnippet = '';

  // 1. Quick regex screening
  for (const [type, regex] of Object.entries(SECRET_REGEXES)) {
    const match = diff.match(regex);
    if (match) {
      detectedSecretType = type;
      matchedSnippet = match[0];
      break;
    }
  }

  if (!detectedSecretType) {
    const result: AgentResult = {
      status: 'Success',
      logMessage: 'No hardcoded credentials, API tokens, or secrets detected in the codebase diff.',
      severity: 'Info'
    };
    await logAgentAudit(prId, result);
    return result;
  }

  // 2. AWS Bedrock verification if credentials are set
  const hasAws = process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_ACCESS_KEY_ID.includes('your-');
  let confirmedByAI = true; // Fallback default

  if (hasAws) {
    try {
      const client = new BedrockRuntimeClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
        }
      });

      const prompt = `You are a security auditor. Analyze the following code snippet and tell me if it contains a real hardcoded secret/API key/credential, or if it is just a safe mock test value.
Snippet: "${matchedSnippet}"

Respond ONLY in the following JSON format:
{
  "isRealSecret": true/false,
  "confidence": 0.0 to 1.0,
  "reason": "explanation of why it is real or mock"
}`;

      const command = new InvokeModelCommand({
        modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const response = await client.send(command);
      const resBody = JSON.parse(new TextDecoder().decode(response.body));
      const responseText = resBody.content[0].text;
      
      const parsed = JSON.parse(responseText.substring(responseText.indexOf('{'), responseText.lastIndexOf('}') + 1));
      confirmedByAI = parsed.isRealSecret;
      console.log(`[SecretScanner] Bedrock analysis: Confirmed=${confirmedByAI}. Reason: ${parsed.reason}`);
    } catch (err) {
      console.warn('⚠️ Bedrock scanner failed or returned bad format. Relying on local regex match verification.', err);
    }
  }

  const result: AgentResult = confirmedByAI
    ? {
        status: 'Failure',
        logMessage: `CRITICAL: Hardcoded ${detectedSecretType.toUpperCase().replace('_', ' ')} detected in code modification: "${matchedSnippet.substring(0, 45)}..."`,
        severity: 'Critical'
      }
    : {
        status: 'Warning',
        logMessage: `SUSPICIOUS: A simulated or mock ${detectedSecretType.toUpperCase().replace('_', ' ')} pattern was found but classified as non-production: "${matchedSnippet.substring(0, 45)}..."`,
        severity: 'Low'
      };

  await logAgentAudit(prId, result);
  return result;
}

async function logAgentAudit(prId: string, result: AgentResult) {
  await db.query(
    `INSERT INTO audit_logs (pr_id, agent_name, status, log_message, severity) VALUES ($1, $2, $3, $4, $5)`,
    [prId, 'SecretScanner', result.status, result.logMessage, result.severity]
  );
}
