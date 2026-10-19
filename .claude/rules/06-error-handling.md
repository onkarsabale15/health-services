# Error Handling Rules

## Exception Hierarchy

```
Error (built-in)
  └── AppError(statusCode, message, body?)     → Custom business errors
        ├── AuthError                           → 401 authentication failures
        ├── ValidationError                     → 400 input validation failures
        ├── NotFoundError                       → 404 resource not found
        └── EhrError                            → EHR vendor-specific errors (maps to 502/503)
```

- `AppError` carries `statusCode` and optional `body` for structured error responses.
- `GlobalExceptionFilter` maps all errors to appropriate HTTP responses.
- Bridge API maps all errors to FHIR `OperationOutcome` format.

## Where to Throw

| Layer | Exception Type | Example |
|-------|---------------|---------|
| **Guards** | `UnauthorizedException` (401) | Missing/invalid token |
| **Guards** | `ForbiddenException` (403) | Insufficient role or scope |
| **Controllers** | `BadRequestException` (400) | Validation failure, missing required field |
| **Controllers** | `NotFoundException` (404) | Resource not found |
| **Controllers** | `ConflictException` (409) | Duplicate resource |
| **Services** | `AppError` subclasses | Business rule violations |
| **Interceptors** | Transform errors | `GlobalExceptionFilter` → FHIR OperationOutcome |

## Where NOT to Throw

- **Cache operations:** Catch silently (`.catch(() => {})`) — cache is best-effort auxiliary, never break the main request flow.
- **Logging:** Never throw in log statements — if logging fails, the request should still succeed.
- **Cleanup/finally blocks:** Never throw during cleanup — log the error and continue.
- **OAuth introspect/revoke:** Return `{active: false}` or `{}` per RFC 7009 — never throw on invalid tokens.
- **Health check sub-checks:** Individual health checks return `status: 'down'`, not exceptions.

## Guard Error Rules

- Guards must ALWAYS throw, never silently return `false`.
- A `false` return produces a generic 403 with no message — impossible to debug.
- **Correct:**
  ```typescript
  throw new ForbiddenException(`Insufficient role. Required: ${requiredRoles.join(', ')}`);
  ```
- **Wrong:**
  ```typescript
  return false;  // produces generic 403 with no context
  ```

## Error Logging

- Always log with structured context:
  ```typescript
  logger.error('Failed to fetch patient', error, { connectionId, patientId, ehrName });
  ```
- **Include:** operation name, relevant IDs, status code, duration (if applicable).
- **Exclude:** tokens, passwords, PHI, full request/response bodies, stack traces in client responses.
- Log at appropriate level:
  - `error` — unexpected failure that needs investigation
  - `warn` — expected failure handled gracefully (e.g., cache miss, rate limit hit)
  - `info` — not for errors

## Error Response Format

### Admin API (standard NestJS)
```json
{
  "statusCode": 400,
  "message": "Application name already exists",
  "error": "Bad Request"
}
```

### Bridge API (FHIR OperationOutcome)
```json
{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "invalid",
    "details": { "text": "Missing required parameter: patient" },
    "diagnostics": "GET /fhir/r4/v1/Condition?patient="
  }]
}
```

### Status Code → FHIR Severity Mapping
| HTTP Status | FHIR Severity | FHIR Issue Code |
|-------------|---------------|-----------------|
| 400 | error | invalid |
| 401 | error | login |
| 403 | error | forbidden |
| 404 | error | not-found |
| 409 | error | conflict |
| 422 | error | processing |
| 429 | warning | throttled |
| 500 | fatal | exception |
| 502/503 | error | transient |

## Error Detection Anti-Patterns

| Anti-pattern | Correct Approach |
|-------------|-----------------|
| `error?.constructor?.name === 'NotFound'` | `error?.status === 404 \|\| error?.code === 'NOT_FOUND'` |
| `catch (e) { /* empty */ }` | `catch (e) { logger.warn('...', e) }` or `.catch(() => {})` only for cache |
| `throw new Error('...')` in guards | `throw new UnauthorizedException('...')` |
| Leaking SQL errors to client | Return generic message, log full error server-side |
