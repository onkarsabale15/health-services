# ehr-data-service — Hot-Zone Notes for AI

## What this package is

Low-level HTTP wrapper around vendor-specific EHR APIs. **No FHIR mapping or clinical logic here** — just HTTP + auth + raw payload return. Returns `EhrResponse<T>` using vendor-specific types.

## Golden Path rule (per CLAUDE.md root)

When understanding EHR patterns, look **only** at `src/vendors/athenanet/athenanet.mapper.ts` (or equivalent for athenanet's adapter pattern). All other vendors follow the same pattern. Don't read multiple vendor files unless debugging a vendor-specific issue.

## Three-Layer EHR Architecture (per memory)

```
Layer 1: ehr-data-service          (this package)
  Pure HTTP + auth + raw vendor payload return.
  No FHIR mapping. No clinical logic. No business rules.

Layer 2: bridge-api/services       (consumer)
  Vendor data services that wrap ehr-data-service.
  FHIR R4 translation lives here. Capability gating lives here.
  Bridge owns mapping; ehr-data-service stays dumb.

Layer 3: cds-app, workflow-app     (consumer of bridge or direct)
  Domain logic. Multi-resource composition. AI agents.
  cds-app always goes through bridge.
  workflow-app can call ehr-data-service directly (perf trade-off).
```

## Documentation-First rule

When modifying ehr-data-service, you **MUST** verify all technical details against official EHR documentation. If inaccessible, ask the user. **NEVER make changes blindly.** Cerner, Epic, Athena, drchrono, eCW, Greenway, Meditech, NextGen, Elation each have their own docs and quirks.

## Generated SDK rule

Files in `src/generated/` (if present) and `packages/*-sdk/src/generated/` are massive (>3000 lines). **NEVER** `read_file` on them in full. Use `grep` to find specific DTOs or methods.

## Vendor adapter shape

```typescript
class XxxService {
  // Auth: token mgmt, refresh, basic-auth, OAuth2 client_credentials, etc.
  // Each vendor has its own auth flow.

  async makeRequest<T>(...): Promise<EhrResponse<T>> {
    // HTTP + auth header + error → EhrError mapping.
  }

  async makeAuthenticatedRequest<T>(...): Promise<EhrResponse<T>> {
    // Token refresh on 401, then makeRequest.
  }

  // Vendor-specific endpoints — pure passthrough, no mapping.
  async getPatient(id: string): Promise<EhrResponse<RawPatient>> { ... }
  async createCondition(body: RawConditionPayload): Promise<EhrResponse<RawCondition>> { ... }
}
```

## Common gotchas

- **Don't add FHIR mapping here.** If you find yourself transforming `note: { text }` to a `string[]`, you're in the wrong package — that's bridge-api's job.
- **Token refresh is per-vendor.** Cerner's refresh flow differs from Athena's; don't generalize prematurely.
- **Error mapping** — every vendor service throws `EhrError` (HTTP status + vendor-specific code). bridge-api maps to FHIR `OperationOutcome`.
- **Logging:** the `logger.warn('HTTP request failed', ...)` includes request body. **Audit before adding sensitive fields** — body must not leak tokens / passwords / PHI.
