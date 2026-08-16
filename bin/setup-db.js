#!/usr/bin/env node
/**
 * Heimdall AI: Automated CockroachDB Setup Script
 * Usage: node bin/setup-db.js   OR   npm run db:setup
 */

require('dotenv').config();
const { Client } = require('pg');

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const YELLOW = '\x1b[33m';
const RESET  = '\x1b[0m';

function log(color, icon, msg) { console.log(`${color}${icon} ${msg}${RESET}`); }

async function main() {
  console.log(`\n${BOLD}${CYAN}Heimdall AI CockroachDB Setup${RESET}\n`);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes('localhost')) {
    log(YELLOW, 'i', 'DATABASE_URL is not set or points to localhost.');
    log(YELLOW, ' ', 'Steps to connect a real CockroachDB Serverless cluster:');
    log(YELLOW, ' ', '  1. Create a free cluster at https://cockroachlabs.cloud');
    log(YELLOW, ' ', '  2. Click Connect -> Connection String -> copy the URL');
    log(YELLOW, ' ', '  3. Paste into .env as DATABASE_URL=postgresql://...');
    log(YELLOW, ' ', '  4. Re-run: npm run db:setup\n');
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    log(CYAN, '->', `Connecting...`);
    await client.connect();
    log(GREEN, 'OK', 'Connected!\n');
  } catch (err) {
    log(RED, 'ERR', `Connection failed: ${err.message}`);
    process.exit(1);
  }

  const steps = [
    ['Table: apis', `CREATE TABLE IF NOT EXISTS apis (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      owner VARCHAR(100),
      team VARCHAR(100),
      auth_type VARCHAR(50),
      cors_origin VARCHAR(255),
      rate_limit VARCHAR(100),
      environment VARCHAR(50),
      status VARCHAR(50),
      compliance_score INT,
      risk_level VARCHAR(20),
      checks_passed TEXT[],
      checks_failed TEXT[],
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`],
    ['Table: api_scan_history', `CREATE TABLE IF NOT EXISTS api_scan_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      api_id UUID REFERENCES apis(id) ON DELETE CASCADE,
      score INT NOT NULL,
      risk VARCHAR(20) NOT NULL,
      passed TEXT[],
      failed TEXT[],
      trigger_type VARCHAR(50),
      scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`],
    ['pgvector extension', 'CREATE EXTENSION IF NOT EXISTS vector;'],
    ['Table: prs', `CREATE TABLE IF NOT EXISTS prs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pr_number INT,
      repo_name VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'Pending',
      author VARCHAR(100),
      title VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`],
    ['Table: audit_logs', `CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pr_id UUID REFERENCES prs(id) ON DELETE CASCADE,
      agent_name VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL,
      log_message TEXT NOT NULL,
      severity VARCHAR(20) DEFAULT 'Info',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`],
    ['Table: vector_policies', `CREATE TABLE IF NOT EXISTS vector_policies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_name VARCHAR(255) UNIQUE NOT NULL,
      category VARCHAR(100) NOT NULL,
      policy_description TEXT NOT NULL,
      keywords VARCHAR(255),
      embedding VECTOR(1536),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`],
    ['Table: exemptions', `CREATE TABLE IF NOT EXISTS exemptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pr_id UUID REFERENCES prs(id) ON DELETE CASCADE,
      filepath VARCHAR(255) NOT NULL,
      overridden_by VARCHAR(100) NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`],
  ];

  for (const [name, sql] of steps) {
    try { await client.query(sql); log(GREEN, 'OK', name); }
    catch (e) { log(RED, 'ERR', `${name}: ${e.message}`); }
  }

  const policies = [
    ['no_secrets', 'Credentials', 'Do not hardcode secrets, API keys, passwords, database URLs or AWS keys in source code. Use environment variables.', 'secret password token key aws credential connection'],
    ['no_sql_injection', 'Database Security', 'Avoid SQL string concatenation. Use parameterized queries or placeholders to prevent SQL injection.', 'sql database query injection concatenate parameter pg'],
    ['secure_cors', 'Network Security', 'Do not set Access-Control-Allow-Origin to wildcard * in production. Restrict to trusted domains.', 'cors access control origin wildcard headers'],
    ['no_deprecated_crypto', 'Cryptography', 'Do not use MD5 or SHA1 for passwords or signatures. Use bcrypt, argon2, SHA256+.', 'md5 sha1 crypto hash bcrypt argon2'],
    ['least_privilege', 'Authorization', 'Do not grant broad admin DB privileges to application roles. Only grant needed read/write on specific tables.', 'rbac admin privileges permission user role db grant'],
  ];

  console.log('');
  log(CYAN, '->', 'Seeding compliance policies...');
  for (const [rule, cat, desc, kw] of policies) {
    try {
      await client.query(
        `INSERT INTO vector_policies (rule_name, category, policy_description, keywords)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (rule_name) DO UPDATE
           SET policy_description=EXCLUDED.policy_description, keywords=EXCLUDED.keywords`,
        [rule, cat, desc, kw]
      );
      log(GREEN, 'OK', `Policy: ${rule}`);
    } catch (e) { log(RED, 'ERR', `Policy ${rule}: ${e.message}`); }
  }

  await client.end();
  console.log(`\n${GREEN}${BOLD}Setup complete! Run: npm run dev:all${RESET}\n`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
