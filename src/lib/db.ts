import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

let pool: Pool | null = null;
let useMock = false;

// Mock In-Memory Database Structure
const mockDb = {
  prs: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      pr_number: 42,
      repo_name: 'acme-copilot',
      status: 'Failed',
      author: 'dev-alex',
      title: 'Fix: update database integration config',
      created_at: new Date(Date.now() - 3600000),
      updated_at: new Date(Date.now() - 3600000)
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      pr_number: 43,
      repo_name: 'acme-copilot',
      status: 'Passed',
      author: 'dev-sarah',
      title: 'Feature: Add secure JWT encryption token client',
      created_at: new Date(Date.now() - 1800000),
      updated_at: new Date(Date.now() - 1800000)
    }
  ] as any[],
  audit_logs: [
    {
      id: 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
      pr_id: '11111111-1111-1111-1111-111111111111',
      agent_name: 'SecretScanner',
      status: 'Failure',
      log_message: 'CRITICAL: Hardcoded Slack Webhook Token found in config.ts: "[REDACTED_MOCK_SLACK_WEBHOOK]"',
      severity: 'Critical',
      created_at: new Date(Date.now() - 3500000)
    },
    {
      id: 'a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2',
      pr_id: '11111111-1111-1111-1111-111111111111',
      agent_name: 'ComplianceAuditor',
      status: 'Warning',
      log_message: 'WARNING: Potential raw SQL query concat identified in db_helper.ts line 24. Standard query parameters should be utilized.',
      severity: 'Medium',
      created_at: new Date(Date.now() - 3400000)
    },
    {
      id: 'a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3',
      pr_id: '22222222-2222-2222-2222-222222222222',
      agent_name: 'SecretScanner',
      status: 'Success',
      log_message: 'No secrets or API keys detected in diff changesets.',
      severity: 'Info',
      created_at: new Date(Date.now() - 1700000)
    },
    {
      id: 'a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4',
      pr_id: '22222222-2222-2222-2222-222222222222',
      agent_name: 'ComplianceAuditor',
      status: 'Success',
      log_message: 'Code complies fully with security regulations.',
      severity: 'Info',
      created_at: new Date(Date.now() - 1600000)
    }
  ] as any[],
  vector_policies: [
    {
      id: 'p1',
      rule_name: 'no_secrets',
      category: 'Credentials',
      policy_description: 'Do not hardcode secrets, API keys, passwords, database URLs, auth tokens, AWS keys, or private SSH keys in the source code. Use environment variables.',
      keywords: 'secret password token key credential connection string'
    },
    {
      id: 'p2',
      rule_name: 'no_sql_injection',
      category: 'Database Security',
      policy_description: 'Avoid SQL query construction using string concatenation. Always use parameterized queries or query placeholders to prevent SQL injection vulnerabilities.',
      keywords: 'sql database query injection concatenate parameter placeholder pg postgres'
    },
    {
      id: 'p3',
      rule_name: 'secure_cors',
      category: 'Network Security',
      policy_description: 'Avoid setting Access-Control-Allow-Origin headers to wildcard "*" in production configurations. Restrict origins to trusted domains.',
      keywords: 'cors access control allow origin wildcard network headers'
    },
    {
      id: 'p4',
      rule_name: 'no_deprecated_crypto',
      category: 'Cryptography',
      policy_description: 'Do not use deprecated or insecure hashing algorithms such as MD5 or SHA1 for passwords, digital signatures, or sensitive cryptography. Use bcrypt, argon2, or SHA256/SHA512.',
      keywords: 'md5 sha1 crypto password hash md5 bcrypt argon2 signature'
    }
  ] as any[],
  exemptions: [] as any[]
};

// Attempt to initialize database pool
const connectionString = process.env.DATABASE_URL;

if (!connectionString || connectionString.includes('your-') || connectionString.includes('localhost:26257')) {
  console.warn('⚠️  DATABASE_URL is not configured or points to default. Falling back to IN-MEMORY MOCK DATABASE.');
  useMock = true;
} else {
  try {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('cockroachlabs.cloud') ? { rejectUnauthorized: false } : undefined
    });
    console.log('🔌 Successfully connected to CockroachDB.');
  } catch (err) {
    console.error('❌ Failed to connect to CockroachDB. Falling back to IN-MEMORY MOCK DATABASE.', err);
    useMock = true;
  }
}

export async function query(text: string, params?: any[]): Promise<any> {
  if (useMock) {
    return runMockQuery(text, params);
  }

  try {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }
    return await pool.query(text, params);
  } catch (err) {
    console.warn('❌ CockroachDB query error, falling back to mock database operations.', err);
    return runMockQuery(text, params);
  }
}

// Simple parser to simulate standard SQL queries in memory
function runMockQuery(sql: string, params: any[] = []): any {
  const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

  // 1. INSERT INTO prs
  if (normalizedSql.startsWith('insert into prs')) {
    const id = Math.random().toString(36).substring(2) + '-mock-uuid';
    const pr_number = params[0] || 1;
    const repo_name = params[1] || 'repo';
    const status = params[2] || 'Pending';
    const author = params[3] || 'author';
    const title = params[4] || 'title';
    const record = { id, pr_number, repo_name, status, author, title, created_at: new Date(), updated_at: new Date() };
    mockDb.prs.push(record);
    return { rows: [record], rowCount: 1 };
  }

  // 2. INSERT INTO audit_logs
  if (normalizedSql.startsWith('insert into audit_logs')) {
    const id = Math.random().toString(36).substring(2) + '-mock-uuid-log';
    const pr_id = params[0];
    const agent_name = params[1];
    const status = params[2];
    const log_message = params[3];
    const severity = params[4] || 'Info';
    const record = { id, pr_id, agent_name, status, log_message, severity, created_at: new Date() };
    mockDb.audit_logs.push(record);
    return { rows: [record], rowCount: 1 };
  }

  // 3. SELECT FROM prs ORDER BY created_at DESC
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from prs')) {
    if (normalizedSql.includes('where id =')) {
      const prId = params[0] || '';
      const found = mockDb.prs.find(p => p.id === prId);
      return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
    }
    // Sort descending
    const sorted = [...mockDb.prs].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    return { rows: sorted, rowCount: sorted.length };
  }

  // 4. SELECT FROM audit_logs WHERE pr_id = $1
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from audit_logs')) {
    const prId = params[0] || '';
    const logs = mockDb.audit_logs.filter(l => l.pr_id === prId);
    return { rows: logs, rowCount: logs.length };
  }

  // 5. SELECT FROM vector_policies
  if (normalizedSql.startsWith('select') && normalizedSql.includes('from vector_policies')) {
    if (normalizedSql.includes('<=>')) {
      const queryVector = params[0];
      const limit = params[1] || 3;
      
      if (!Array.isArray(queryVector)) {
        return { rows: mockDb.vector_policies.slice(0, limit), rowCount: Math.min(limit, mockDb.vector_policies.length) };
      }

      const policiesWithDistance = mockDb.vector_policies.map(p => {
        const policyVector = generateMockVector(p.policy_description);
        const distance = calculateCosineDistance(queryVector, policyVector);
        return { ...p, distance };
      });

      const sorted = policiesWithDistance.sort((a, b) => a.distance - b.distance);
      return { rows: sorted.slice(0, limit), rowCount: Math.min(limit, sorted.length) };
    }
    return { rows: mockDb.vector_policies, rowCount: mockDb.vector_policies.length };
  }

  // 6. UPDATE prs SET status = $1 WHERE id = $2
  if (normalizedSql.startsWith('update prs')) {
    const status = params[0];
    const id = params[1];
    const pr = mockDb.prs.find(p => p.id === id);
    if (pr) {
      pr.status = status;
      pr.updated_at = new Date();
    }
    return { rows: pr ? [pr] : [], rowCount: pr ? 1 : 0 };
  }

  // Fallback default
  return { rows: [], rowCount: 0 };
}

// Vector similarity helper functions for mock queries
function generateMockVector(text: string): number[] {
  const dims = 1536;
  const vector: number[] = new Array(dims);
  let seed = 0;
  for (let i = 0; i < text.length; i++) {
    seed = (seed + text.charCodeAt(i) * (i + 1)) % 1000000;
  }
  let currentSeed = seed || 12345;
  const lcg = () => {
    currentSeed = (1103515245 * currentSeed + 12345) % 2147483648;
    return currentSeed / 2147483648;
  };
  let sumSq = 0;
  for (let i = 0; i < dims; i++) {
    const val = lcg() * 2 - 1;
    vector[i] = val;
    sumSq += val * val;
  }
  const magnitude = Math.sqrt(sumSq);
  for (let i = 0; i < dims; i++) {
    vector[i] = vector[i] / magnitude;
  }
  return vector;
}

function calculateCosineDistance(v1: number[], v2: number[]): number {
  if (!v1 || !v2 || v1.length !== v2.length) return 1.0;
  let dotProduct = 0;
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
  }
  return 1.0 - dotProduct;
}
