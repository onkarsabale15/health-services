#!/bin/bash
# Scan staged files for accidentally committed secrets.
# Patterns: AWS keys, API tokens, private keys, .env values, JWTs

set -e

FILES=$(git diff --cached --name-only --diff-filter=ACM)
if [ -z "$FILES" ]; then
  exit 0
fi

PATTERNS=(
  'AKIA[0-9A-Z]{16}'             # AWS Access Key
  'sk-[a-zA-Z0-9]{20,}'          # OpenAI / Anthropic API key
  'ghp_[a-zA-Z0-9]{36}'          # GitHub Personal Access Token
  'gho_[a-zA-Z0-9]{36}'          # GitHub OAuth Token
  'glpat-[a-zA-Z0-9\-]{20}'      # GitLab Personal Access Token
  '-----BEGIN (RSA |EC )?PRIVATE KEY-----'  # Private keys
  'password\s*[:=]\s*["\x27][^"\x27]{8,}'   # Hardcoded passwords
  'DOPPLER_TOKEN\s*[:=]'          # Doppler token
  'dp\.st\.[a-zA-Z0-9]+'         # Doppler service token
)

FOUND=0
for pattern in "${PATTERNS[@]}"; do
  MATCHES=$(echo "$FILES" | xargs grep -lPn "$pattern" 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    echo "ERROR: Potential secret found matching pattern: $pattern"
    echo "$MATCHES"
    FOUND=1
  fi
done

# Check for .env files being committed
ENV_FILES=$(echo "$FILES" | grep -E '\.env$|\.env\.local$|\.env\.production$' || true)
if [ -n "$ENV_FILES" ]; then
  echo "ERROR: .env file(s) staged for commit:"
  echo "$ENV_FILES"
  FOUND=1
fi

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo "Secrets detected in staged files. Remove them before committing."
  echo "If this is a false positive, use: git commit --no-verify"
  exit 1
fi
