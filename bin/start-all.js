#!/usr/bin/env node
/**
 * Heimdall AI: Unified Dev Launcher
 * Starts Next.js, Python Flask, and prints Go instructions in one terminal.
 * Usage: npm run dev:all
 */

const { spawn } = require('child_process');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const MAGENTA = '\x1b[35m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';

function prefixedLogger(prefix, color) {
  return (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => console.log(`${color}[${prefix}]${RESET} ${line}`));
  };
}

function startProcess(name, cmd, args, color, cwd) {
  console.log(`${color}${BOLD}[${name}]${RESET} Starting: ${cmd} ${args.join(' ')}`);
  const proc = spawn(cmd, args, {
    cwd: cwd || process.cwd(),
    shell: true,
    env: { ...process.env },
  });

  proc.stdout.on('data', prefixedLogger(name, color));
  proc.stderr.on('data', prefixedLogger(name, color));

  proc.on('close', (code) => {
    if (code !== 0) {
      console.log(`${RED}[${name}] Process exited with code ${code}. Restarting in 3s...${RESET}`);
      setTimeout(() => startProcess(name, cmd, args, color, cwd), 3000);
    }
  });

  return proc;
}

console.log(`\n${BOLD}${CYAN}==========================================`);
console.log(`  Heimdall AI  Unified Service Launcher`);
console.log(`==========================================${RESET}\n`);

// Start Next.js dev server
startProcess('Next.js', 'npx', ['next', 'dev'], BLUE);

// Start Python Flask embeddings service
setTimeout(() => {
  startProcess('Py-Embeddings', 'python', ['services/python/embeddings.py'], MAGENTA);
}, 2000);

// Start Python API Registry service
setTimeout(() => {
  startProcess('Py-Registry', 'python', ['services/python/api_registry.py'], CYAN);
}, 3000);

// Start Python LLM Agnostic Gateway (MVP 5)
setTimeout(() => {
  startProcess('Py-LLMGateway', 'python', ['services/python/llm_gateway.py'], MAGENTA);
}, 4000);

// Print Go instructions
setTimeout(() => {
  console.log(`\n${YELLOW}[Go Worker]${RESET} To start the Go queue worker, open a separate terminal and run:`);
  console.log(`${YELLOW}            go run services/go/worker/main.go${RESET}`);
  console.log(`\n${YELLOW}[Go Monitor]${RESET} To start the API health monitor, open another terminal and run:`);
  console.log(`${YELLOW}             go run services/go/monitor/main.go${RESET}\n`);
  console.log(`${GREEN}${BOLD}All core services started! Open http://localhost:3000${RESET}\n`);
}, 5000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n${RED}${BOLD}[Launcher] Shutting down all services...${RESET}`);
  process.exit(0);
});
