# Heimdall AI: Autonomous Multi-Model Code Security Gatekeeper

Heimdall AI is a polyglot, AI-powered security orchestrator designed to intercept, analyze, and automatically remediate vulnerabilities in Pull Requests before they are merged. It combines static analysis, dynamic API testing (DAST), vector similarity compliance checks, and a novel **Round Robin Multi-Model Debate** engine to eliminate false positives.

## ðŸš€ Key Features

*   **Round Robin AI Triage:** Instead of relying on a single LLM, Heimdall AI pits three distinct AI personas (Security Auditor, Practical Developer, and Compliance Officer) against each other in a debate to determine if a finding is a True Positive or False Positive.
*   **Polyglot Microservices:** Built with the right tool for the job.
    *   **TypeScript/Next.js:** Orchestrator, multi-agent logic, and unified React dashboard.
    *   **Python:** API Registry CRM, LLM Agnostic Gateway, and AWS Titan Vector Embeddings.
    *   **Go:** High-concurrency background job processor and API DAST Fuzzer.
    *   **Java:** AST parsing for deep class-level syntax analysis.
*   **CockroachDB + pgvector:** Leverages CockroachDB Serverless for globally distributed, resilient storage, and `pgvector` for executing RAG (Retrieval-Augmented Generation) cosine similarity searches against organizational security policies.
*   **API Security CRM & DAST:** A complete registry to track API endpoints, score their compliance (Auth, CORS, HTTPS), and proactively fuzz them with SQL injection payloads every 30 seconds via the Go monitor.
*   **LLM Agnostic Gateway:** Seamlessly swap between AWS Bedrock, OpenAI, Anthropic, or local Ollama models without modifying the core TypeScript agents.
*   **Auto-Remediation:** Automatically generates `git diff` patches for True Positives and verifies them via a CI dry-run syntax check before proposing them to the developer.

## ðŸ—ï¸ Architecture Overview

The ecosystem consists of several interconnected components running simultaneously:
1.  **Frontend/Orchestrator (`:3000`)**: Next.js 14 App Router application handling the UI, PR Webhooks, and executing the Agent pipeline.
2.  **Embeddings API (`:5001`)**: Python Flask service connecting to AWS Bedrock to generate Titan Text embeddings.
3.  **API Registry (`:5002`)**: Python Flask CRM managing the API inventory in CockroachDB.
4.  **Go Monitor (`:5003`)**: Go routine pinging and DAST fuzzing the registered APIs every 30s.
5.  **LLM Gateway (`:5004`)**: Python proxy for routing all AI prompts to the configured provider.

*(Detailed architecture diagrams are located in the `/architecture/` folder, which is currently ignored by git).*

## ðŸ› ï¸ Installation & Setup

### Prerequisites
*   Node.js (v18+)
*   Python 3.10+
*   Go 1.20+
*   CockroachDB Serverless Cluster (with `pgvector` enabled)

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd Heimdall AI
npm install
```

### 2. Configure Environment
Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL="postgresql://user:pass@host:26257/defaultdb?sslmode=verify-full"

# AWS Bedrock (Required for Embeddings and default LLM)
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"
BEDROCK_MODEL_ID="anthropic.claude-3-sonnet-20240229-v1:0"

# NextAuth Dashboard Security
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="super-secret-Heimdall AI-key-123"

# GitHub Integration
GITHUB_WEBHOOK_SECRET="your-github-webhook-secret"

# LLM Gateway Configuration (mock | bedrock | openai | ollama)
LLM_PROVIDER="bedrock"
```

### 3. Initialize Database Schema
Run the setup script to provision the required tables in CockroachDB:
```bash
npm run db:setup
```

### 4. Start the Ecosystem
Heimdall AI includes a unified launcher that spins up all microservices:
```bash
npm run dev:all
```

## ðŸŽ® Usage Guide

1.  **Dashboard Access:** Navigate to `http://localhost:3000`. Log in using the default credentials (`admin` / `admin`).
2.  **Scanning a PR:** In the Security Workspaces tab, paste a real GitHub PR URL (e.g., `https://github.com/owner/repo/pull/123`) and click "Scan".
3.  **API Registry:** Navigate to the API Registry tab to register new endpoints. The Go Monitor will automatically begin fuzzing and scoring them in the background.

## ðŸ¤ Contributing
Contributions are welcome! Please ensure you run tests and verify the architecture diagram flows in the `architecture` folder before submitting major PRs.
