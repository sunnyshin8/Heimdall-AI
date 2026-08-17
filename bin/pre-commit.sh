#!/bin/sh

# Heimdall AI Git Pre-Commit Hook Integration
# Intercepts commit stages and audits changes locally before they hit the repository.

echo "🛡️  [Heimdall AI Hook] Intercepting commit... Running compliance checks..."

# Retrieve list of modified files in the staging area
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|tsx|json|java|go)$')

if [ -z "$STAGED_FILES" ]; then
    echo "🟢 [Heimdall AI Hook] No application code files modified in staging. Allowing commit."
    exit 0
fi

echo "🔍  Staged files to audit:"
echo "$STAGED_FILES"

# Trigger local Heimdall AI scanner
# Pass the targets to bin/Heimdall AI.js
node bin/Heimdall AI.js scan target

SCAN_EXIT_CODE=$?

if [ $SCAN_EXIT_CODE -ne 0 ]; then
    echo "\nâŒ [Heimdall AI Hook] COMMIT BLOCKED: Security or compliance policy violations detected."
    echo "Check audit logs above or open the dashboard (http://localhost:3000) for remediation patches.\n"
    exit 1
fi

echo "\n🟢 [Heimdall AI Hook] Scan passed or exempted by Multi-Model Triage. Committing changes.\n"
exit 0
