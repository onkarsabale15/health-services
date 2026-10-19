# SOLID Principles

## Single Responsibility (SRP)

- **One class/module = one reason to change.**
  - Controller → HTTP layer (routes, guards, decorators, response codes)
  - Service → business logic (DB queries, cache, validation, rules)
  - Repository → data access (Prisma queries)
  - Guard → auth/authz only — never business logic
  - Interceptor → cross-cutting concerns (caching, response shaping) — never domain rules
- Cache key builders live in `apps/*/src/cache/`, NOT in domain packages.
- Each EHR vendor service handles one vendor. Shared mechanics go in `BaseEhrService`.
- `@hs/cds-engine` handles AI logic only — zero infrastructure dependencies.

## Open/Closed (OCP)

- **Open for extension, closed for modification.**
- New EHR vendor = new service file, no changes to existing vendors or factory.
- New CDS rule type = new agent file in `@hs/cds-engine`, no modification to the orchestrator.
- New FHIR resource = new controller extending `BaseFhirController`, no changes to existing controllers.
- Use strategy/factory patterns (e.g., `ehrFactory.getService()`) instead of switch/if-else chains.
- New auth method = new guard strategy, not modification of existing guard.

## Liskov Substitution (LSP)

- **All implementations of an interface must be interchangeable.**
- Every `IEhrService` implementation must work identically from the caller's perspective.
- All LLM providers via `createModel()` must return a compatible `BaseChatModel`.
- All `ICache` implementations (Redis today, Memcached tomorrow) must honor the same contract.
- All `ISecretsProvider` implementations (Doppler, AWS) must be swappable without caller changes.
- If a subclass needs to change the behavior of a parent method, the change must still satisfy the parent's contract.

## Interface Segregation (ISP)

- **No client should depend on methods it doesn't use.**
- `ICache` is separate from `IDistributedLock` — consumers import only what they need.
- FHIR tools are separate (`fhir_search`, `fhir_read`) — not a monolithic `fhir_do_everything`.
- `ILogger` has `info/warn/error/debug` — no `trace/fatal/silly` bloat.
- `ISecretsProvider` has `get/put/delete` — no `list/rotate` unless a consumer needs them.
- Prefer many small interfaces over one large interface.

## Dependency Inversion (DIP)

- **Depend on abstractions, not concretions.**
- Domain logic depends on interfaces (`ICache`, `IHttpClient`, `ILogger`), not Redis/Axios/Winston directly.
- `@hs/cds-engine` has ZERO infrastructure dependencies — FHIR fetch functions are injected by the caller.
- EHR services depend on `IHttpClient`, not Axios.
- Token refresh depends on `ICache.setNx()`, not Redis SETNX.
- Controllers import from `@hs/db`, `@hs/cache` — never from `ioredis` or `@prisma/client` directly.
- High-level modules (apps) define what they need. Low-level modules (packages) implement it.

## Applying SOLID in This Codebase

| Principle | Example | Anti-pattern |
|-----------|---------|-------------|
| SRP | `SessionGuard` only verifies JWT | Guard that also queries DB for user permissions |
| OCP | `ehrFactory.register('epic', epicService)` | `if (ehr === 'epic') { ... } else if (ehr === 'cerner') { ... }` |
| LSP | `DopplerSecretsProvider` and `AwsSecretsProvider` both implement `ISecretsProvider` | Provider that throws "not supported" for a method |
| ISP | `ICache` separate from `IDistributedLock` | Single `IRedis` interface with 50 methods |
| DIP | `cds-engine` receives `searchFhir` function | `cds-engine` imports `axios` and calls Bridge API directly |
