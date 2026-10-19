#!/bin/bash
# Check that NEW code doesn't introduce `any` at interface boundaries.
# Scans only newly added lines (git diff +) in staged .ts/.tsx files.
# Flags: function params typed as `any`, return types `any`, public exports with `any`.
# Does NOT flag existing code — only new additions in this commit.

set -e

FILES=$(git diff --cached --name-only --diff-filter=ACM -- '*.ts' '*.tsx' | \
  grep -v '\.spec\.' | \
  grep -v '\.test\.' | \
  grep -v '__tests__' | \
  grep -v 'generated' || true)

if [ -z "$FILES" ]; then
  exit 0
fi

# Check new lines only for interface-boundary `any`:
#   - function/method params: (param: any)
#   - return types: ): any {
#   - exported types: export type X = any
#   - interface fields: field: any
# Exclude: `as any` (internal cast, tolerated), catch blocks, comments
VIOLATIONS=$(git diff --cached -- $FILES | \
  grep '^\+' | \
  grep -v '^\+\+\+' | \
  grep -v '// .*any' | \
  grep -v 'catch' | \
  grep -v 'as any' | \
  grep -E ':\s*any\b[^a-zA-Z]|:\s*any$' || true)

if [ -n "$VIOLATIONS" ]; then
  echo "WARNING: New 'any' types found at interface boundaries in staged code:"
  echo "$VIOLATIONS"
  echo ""
  echo "Use proper types instead of 'any'. See rule 07-typescript.md."
  echo "If justified (untyped external lib), add a comment explaining why."
  # Warning only — don't block the commit
  # To make this a hard block, change to: exit 1
fi
