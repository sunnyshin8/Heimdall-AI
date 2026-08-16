#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Load the compiled DB and orchestrator modules
// Since we are running in ts-node or transpiled, we can dynamically compile/register ts-node OR run the TS code directly using ts-node/register,
// or we can import the transpiled versions. Let's make it easy: register ts-node dynamically so judges can run it directly without building!
try {
  require('ts-node').register({
    project: path.resolve(__dirname, '../tsconfig.cjs.json')
  });
} catch (e) {
  // If ts-node is not installed, print warning
}

const orchestrator = require('../src/lib/agents/orchestrator');

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help') {
  printHelp();
  process.exit(0);
}

if (command === 'scan') {
  const target = args[1];
  runScan(target);
} else {
  console.log(`Unknown command: "${command}". Use "help" for options.`);
  process.exit(1);
}

function printHelp() {
  console.log(`
🛡️  Heimdall AI CLI Simulator
=============================
Usage:
  node bin/agentguard.js scan <path_to_file_or_folder>
  node bin/agentguard.js scan mock  (Runs a scan on a sample vulnerable file diff)

Options:
  help    Show this screen
`);
}

async function runScan(target) {
  let diff = '';
  let title = 'Codebase Scan';

  if (!target || target === 'mock') {
    console.log('📌 No file path specified. Running scan with sample VULNERABLE code diff...');
    diff = `
diff --git a/config.ts b/config.ts
index 123456..789101 100644
--- a/config.ts
+++ b/config.ts
@@ -10,6 +10,12 @@
 export const CONFIG = {
   PORT: 3000,
-  API_URL: "https://api.staging.acme.com",
+  API_URL: "https://api.production.acme.com",
+  SLACK_WEBHOOK_URL: "[REDACTED_MOCK_SLACK_WEBHOOK]",
+  DATABASE_URL: "postgresql://root:my-secure-password-123@db-cockroach.acme.com:26257/prod"
 };
 
diff --git a/db_helper.ts b/db_helper.ts
--- a/db_helper.ts
+++ b/db_helper.ts
@@ -20,5 +20,9 @@
 export async function getUserByName(name: string) {
-  return db.query("SELECT * FROM users WHERE name = $1", [name]);
+  // Quick hack to query directly
+  const rawQuery = "SELECT * FROM users WHERE name = '" + name + "'";
+  return db.query(rawQuery);
 }
+
+export const CORS_HEADERS = {
+  "Access-Control-Allow-Origin": "*"
+};
`;
    title = 'Simulation: Vulnerability PR check';
  } else {
    const resolvedPath = path.resolve(target);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Error: File or directory does not exist: ${resolvedPath}`);
      process.exit(1);
    }

    const stats = fs.statSync(resolvedPath);
    if (stats.isFile()) {
      const content = fs.readFileSync(resolvedPath, 'utf8');
      diff = `
diff --git a/${path.basename(resolvedPath)} b/${path.basename(resolvedPath)}
--- a/${path.basename(resolvedPath)}
+++ b/${path.basename(resolvedPath)}
@@ -1,1 +1,${content.split('\n').length} @@
+${content.split('\n').join('\n+')}
`;
      title = `Audit File: ${path.basename(resolvedPath)}`;
    } else {
      console.log(`📂 Scanning directory: ${resolvedPath}...`);
      // Recursively aggregate a couple of source files
      const files = getFilesRecursively(resolvedPath);
      if (files.length === 0) {
        console.error('No readable text files found in the directory.');
        process.exit(1);
      }

      diff = files.map(f => {
        const content = fs.readFileSync(f, 'utf8');
        const relative = path.relative(resolvedPath, f);
        return `
diff --git a/${relative} b/${relative}
--- a/${relative}
+++ b/${relative}
@@ -1,1 +1,${content.split('\n').length} @@
+${content.split('\n').join('\n+')}
`;
      }).join('\n');

      title = `Audit Directory: ${path.basename(resolvedPath)}`;
    }
  }

  try {
    const scanResult = await orchestrator.executeAuditPipeline({
      prNumber: Math.floor(Math.random() * 1000) + 100,
      repoName: 'local-workspace-scan',
      author: process.env.USERNAME || process.env.USER || 'developer',
      title,
      diff
    });

    console.log('\n==================================================');
    console.log('🛡️  Heimdall AI Audit Complete');
    console.log('==================================================');
    console.log(`📂 Repository: ${scanResult.repoName}`);
    console.log(`📌 PR Number:  #${scanResult.prNumber}`);
    console.log(`📊 Status:     ${scanResult.status === 'Passed' ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('==================================================');
    console.log('\n🤖 Agent Logs:');

    scanResult.logs.forEach(log => {
      const statusIcon = log.status === 'Success' ? '🟢' : log.status === 'Warning' ? '🟡' : '🔴';
      console.log(`\n[${statusIcon} ${log.agent_name}] [${log.severity}]`);
      console.log(`${log.log_message}`);
    });

    console.log('\n==================================================');
    process.exit(scanResult.status === 'Passed' ? 0 : 1);
  } catch (err) {
    console.error('❌ Audit execution failed:', err);
    process.exit(1);
  }
}

function getFilesRecursively(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    // Ignore node_modules, .git, etc.
    if (file === 'node_modules' || file === '.git' || file === '.next' || file === 'dist') return;

    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath));
    } else {
      // Focus on source files
      if (/\.(js|ts|tsx|jsx|json|py|go|rs|md|html)$/.test(file)) {
        results.push(filePath);
      }
    }
  });
  return results.slice(0, 10); // Cap at 10 files to avoid context blowout
}
