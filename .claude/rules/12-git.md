# Git & PR Rules

## Commits

### Message Format
```
<type>: <concise description>

[optional body — explain why, not what]
```

### Prefixes
| Prefix | When to Use | Example |
|--------|-------------|---------|
| `feat:` | New feature or endpoint | `feat: add composite /applications/:id/detail endpoint` |
| `fix:` | Bug fix | `fix: prevent refresh token replay with atomic getdel` |
| `refactor:` | Code restructure, no behavior change | `refactor: extract org boundary validation utility` |
| `perf:` | Performance improvement | `perf: add Redis-backed centralized rate limiting` |
| `chore:` | Tooling, deps, config | `chore: update @nestjs/throttler to v6` |
| `docs:` | Documentation | `docs: add caching rules to .claude/rules` |
| `test:` | Tests only | `test: add unit tests for identity tracker` |
| `style:` | Formatting only | `style: fix indentation in auth controller` |

### Commit Rules
- One logical change per commit. Don't mix refactoring with feature work.
- Keep commits small and focused — easier to review, revert, and bisect.
- Commit message must be understandable without reading the diff.
- Never commit secrets, `.env` files, or large binaries.

## Branches

| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | Production-ready, always buildable | Protected, requires PR |
| `feature/{description}` | New feature | — |
| `fix/{description}` | Bug fix | — |
| `refactor/{description}` | Code restructure | — |
| `chore/{description}` | Tooling/config changes | — |

- Branch names: lowercase, hyphen-separated: `feature/identity-based-rate-limiting`.
- Never force-push to `main`.
- Delete branch after merge.
- Keep branches short-lived — merge within 1-3 days.

## Pull Requests

### PR Title
- Short, imperative: `Add identity-based rate limiting` (not `Added stuff` or `WIP`).
- Under 70 characters.
- Matches the primary commit prefix: `feat:`, `fix:`, etc.

### PR Body Template
```markdown
## Summary
- [1-3 bullet points describing what changed and why]

## Changes
- [List of files/modules changed]

## Test Plan
- [ ] `turbo build` passes (all 15+ tasks green)
- [ ] Manual testing of affected endpoints
- [ ] Edge cases verified (error paths, rate limits, etc.)
```

### PR Requirements
- Build must pass: `turbo build` — all tasks green.
- No `console.log` in production code.
- No new `any` at interface boundaries without justification.
- No secrets or credentials in diff.
- At least one review before merge for production code.
- Squash merge preferred for feature branches (clean history).

## Code Review Checklist

- [ ] Tenant isolation: queries include `organizationId`?
- [ ] Input validation: DTOs with class-validator?
- [ ] Error handling: proper exceptions, no silent failures?
- [ ] Cache: TTL set, invalidation handled?
- [ ] Types: no unjustified `any`?
- [ ] Security: no secrets in code, no PHI in logs?
- [ ] Performance: no N+1 queries, paginated lists?
- [ ] Tests: error paths covered?
