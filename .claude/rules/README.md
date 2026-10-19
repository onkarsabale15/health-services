# Engineering Rules & Standards — Health Services

> These rules apply to ALL code in this monorepo. Every contributor (human or AI) MUST follow them.
> Violations in PRs must be flagged. No exceptions without documented justification.

## Rule Files

| # | File | Scope |
|---|------|-------|
| 01 | [solid.md](./01-solid.md) | SRP, OCP, LSP, ISP, DIP — mapped to this codebase |
| 02 | [database.md](./02-database.md) | ACID, Prisma, queries, indexes, migrations, tenant isolation |
| 03 | [security.md](./03-security.md) | Auth, authz, input validation, secrets, HIPAA, rate limiting |
| 04 | [caching.md](./04-caching.md) | Key naming, TTL, invalidation, multi-tier, client cache control |
| 05 | [api-design.md](./05-api-design.md) | REST, FHIR R4, Swagger/OpenAPI, versioning |
| 06 | [error-handling.md](./06-error-handling.md) | Exception hierarchy, where to throw, guard errors |
| 07 | [typescript.md](./07-typescript.md) | Type safety, generics, naming, imports, async/await, code style |
| 08 | [nestjs.md](./08-nestjs.md) | Module structure, guard order, interceptors, providers, decorators |
| 09 | [frontend.md](./09-frontend.md) | Components, state, API integration, UX patterns, Tailwind |
| 10 | [monorepo.md](./10-monorepo.md) | Package boundaries, shared packages, dependencies, build/CI |
| 11 | [testing.md](./11-testing.md) | What to test, AAA pattern, mocking, naming |
| 12 | [git.md](./12-git.md) | Commits, branches, PRs |
| 13 | [observability.md](./13-observability.md) | Structured logging, tracing, what NOT to log |
| 14 | [performance.md](./14-performance.md) | Backend, frontend, Redis optimization |
| 15 | [sso-oauth.md](./15-sso-oauth.md) | SSO flow, OAuth 2.0 PKCE, redirect validation, token security |
| 16 | [cds-capability-driven.md](./16-cds-capability-driven.md) | Per-EHR rules live in the provider class; controllers / builders / FE consume them as data, never branch on `ehrName` |
| 17 | [plans-in-repo.md](./17-plans-in-repo.md) | All durable plans live in `docs/plans/`. `.claude/plans/` is plan-mode scratch only. Always read/write plans from the repo. |

## Quick Reference

| Principle | Rule | Enforced By |
|-----------|------|-------------|
| SRP | One class = one responsibility | Code review |
| OCP | New features = new files, not modifications | Code review |
| LSP | All interface impls are interchangeable | TypeScript compiler |
| ISP | Focused interfaces, no bloat | Code review |
| DIP | Domain depends on abstractions | Import checks |
| ACID | Transactions for multi-step writes | Code review |
| Tenant isolation | Every query includes `organizationId` | Code review + tests |
| No PHI in logs | Structured logging with explicit fields | Code review |
| No `any` at boundaries | Typed params, returns, public APIs | TypeScript strict mode |
| Generics for reusable code | Use `<T>` for shared infra (cache, mappers, wrappers, hooks) | Code review |
| No `console.log` | Use `@hs/logger` exclusively | ESLint `no-console` |
| Cache TTL mandatory | Every `cache.set()` has a TTL | Code review |
| `await` critical ops | No fire-and-forget for state writes | Code review |
| Guards throw, not return false | Guards throw exceptions with context | Code review |
| Secrets in Doppler/AWS | Zero secrets in code or committed files | `.gitignore` + review |
| No JWTs in URLs | Use opaque SSO codes for cross-app auth | Code review |
| `redirect_uri` whitelist | Validate against registered origins before issuing auth codes | Code review |
| `return_url` validation | Check origin matches trusted server before redirecting | Code review |
| Refresh token rotation | Atomic `getdel` + issue new token on every refresh | Code review |
| Server-side revoke on sign-out | Call `/oauth/revoke` before clearing local state | Code review |
| Per-EHR rules in provider only | No `if (ehrName === ...)` outside the factory; consumers read `getCapabilities()` | Code review |
| Plans in repo, not `.claude/plans/` | Finalized plans live in `docs/plans/`, indexed by README. `.claude/plans/` is plan-mode scratch only. | Code review + plan-mode discipline |
