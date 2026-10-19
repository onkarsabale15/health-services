# API Design Rules

## REST Conventions

- **Resource-oriented URLs:** `/applications/:id`, not `/getApplication`.
- **HTTP methods:**
  - `GET` — read (safe, idempotent)
  - `POST` — create (not idempotent)
  - `PATCH` — partial update (idempotent)
  - `PUT` — full replace (idempotent)
  - `DELETE` — remove (idempotent)
- **Status codes:**

  | Code | Meaning | When to Use |
  |------|---------|-------------|
  | 200 | OK | Success with body |
  | 201 | Created | Resource created (POST) |
  | 204 | No Content | Success without body |
  | 304 | Not Modified | ETag match (cache hit) |
  | 400 | Bad Request | Validation error, missing fields |
  | 401 | Unauthorized | Missing/invalid token |
  | 403 | Forbidden | Valid token, insufficient permissions |
  | 404 | Not Found | Resource doesn't exist |
  | 409 | Conflict | Duplicate (e.g., email already registered) |
  | 429 | Too Many Requests | Rate limited |
  | 500 | Internal Server Error | Unhandled exception (should never be intentional) |

- **URL naming:** plural nouns (`/applications`, not `/application`), lowercase, hyphen-separated for multi-word resources.
- **Path parameters** for resource identity: `/applications/:id`.
- **Query parameters** for filtering/pagination: `?status=ACTIVE&page=1&limit=50`.

## FHIR R4 Compliance

- All FHIR endpoints follow `/fhir/r4/v1/{ResourceType}` pattern.
- Responses use `Content-Type: application/fhir+json; charset=utf-8`.
- Errors return FHIR `OperationOutcome`:
  ```json
  {
    "resourceType": "OperationOutcome",
    "issue": [{
      "severity": "error",
      "code": "not-found",
      "details": { "text": "Patient/123 not found" }
    }]
  }
  ```
- Search results return FHIR `Bundle` with `type: 'searchset'`.
- Pagination links in Bundles are rewritten from EHR URLs to Bridge URLs.
- Resource IDs are opaque strings — never expose internal database IDs.
- Support standard FHIR search parameters: `_id`, `_count`, `_include`, `_revinclude`, `patient`.

## Request/Response Standards

- All request bodies must be validated via DTOs (class-validator for NestJS, Zod for pure TS).
- All responses must be typed — no `any` in controller return types.
- Composite endpoints (e.g., `/applications/:id/detail`) return multiple related datasets in one call to reduce frontend round-trips.
- Batch status endpoints (e.g., `/jwks/status`) return all environment statuses in one call.
- Error responses must include a machine-readable `error` field and a human-readable `message` field.
- Dates in ISO 8601 format: `2024-01-15T10:30:00Z`.

## Swagger/OpenAPI

- Every controller must have `@ApiTags()` for grouping.
- Every endpoint must have `@ApiOperation({ summary })` for documentation.
- Every endpoint must have `@ApiResponse()` for success and error status codes.
- DTOs should have `@ApiProperty()` for request/response documentation.
- Public endpoints must have `@ApiSecurity({})` to indicate no auth required.
- Swagger UI available at `/docs` in development.

## Versioning

- API version is in the URL path: `/fhir/r4/v1/`, `/v1/smart/`, `/api/analysis/`.
- Breaking changes require a new version (`v2`), never modify `v1` semantics.
- Non-breaking additions (new optional fields, new endpoints) do NOT require a version bump.
- Deprecation: add `@ApiDeprecated()` and `Sunset` header, maintain for at least 2 releases.

## Endpoint Design Patterns

| Pattern | Example | When to Use |
|---------|---------|-------------|
| CRUD | `GET/POST/PATCH/DELETE /applications` | Standard resource management |
| Composite | `GET /applications/:id/detail` | Page loads needing multiple related entities |
| Batch status | `GET /jwks/status` | UI needs status of multiple sub-resources |
| Action | `POST /applications/:id/rotate-secret` | Non-CRUD operations on a resource |
| Nested | `GET /applications/:appId/ehr/:ehrName` | Sub-resources scoped to parent |
