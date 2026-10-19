#!/bin/bash
# Check that staged production code doesn't contain console.log/warn/error.
# Allows console in test files, scripts, and config files.

set -e

FILES=$(git diff --cached --name-only --diff-filter=ACM -- '*.ts' '*.tsx' | \
  grep -v '\.spec\.' | \
  grep -v '\.test\.' | \
  grep -v '__tests__' | \
  grep -v 'scripts/' | \
  grep -v 'jest\.' | \
  grep -v '\.config\.' || true)

if [ -z "$FILES" ]; then
  exit 0
fi

# Check only the staged diff (new lines only, marked with +)
VIOLATIONS=$(git diff --cached -- $FILES | grep -n '^\+.*console\.\(log\|warn\|error\|info\|debug\)' | grep -v '^\+\+\+' || true)

if [ -n "$VIOLATIONS" ]; then
  echo "ERROR: console.log/warn/error found in staged production code:"
  echo "$VIOLATIONS"
  echo ""
  echo "Use @hs/logger instead: logger.info(), logger.warn(), logger.error(), logger.debug()"
  echo "If this is intentional, use: git commit --no-verify"
  exit 1
fi
