# NestJS Rules

## Module Structure

```
modules/{feature}/
  ├── {feature}.module.ts        → Module declaration (imports, controllers, providers, exports)
  ├── {feature}.controller.ts    → HTTP layer (routes, guards, decorators, response codes)
  ├── {feature}.service.ts       → Business logic (optional — extract when controller exceeds ~200 lines)
  └── {feature}.dto.ts           → Request/response validation (class-validator decorators)
```

- Every feature gets its own module — no dumping endpoints into shared modules.
- Module `imports` only what it needs. Use `@Global()` sparingly (only for truly shared services).
- Controllers are thin — route handling, parameter extraction, delegating to services.

## Guard Execution Order

Guards execute in registration order (globally registered first):

### admin-api
1. `ThrottlerGuard` (global) — rate limiting (uses identity tracker, `request.user` NOT available yet)
2. Per-route `SessionGuard` — JWT verification, sets `request.user`
3. Per-route `RolesGuard` — checks `@Roles()` metadata against `request.user.role`

### bridge-api
1. `ThrottlerGuard` (global) — rate limiting
2. `DualAuthGuard` (global) — platform JWT or API key authentication, sets `request.user`
3. `RolesGuard` (global) — role check (skips if no `@Roles()` decorator)
4. `ScopeGuard` (global) — FHIR scope check (platform tokens only, skips API keys)

**Critical:** Never assume `request.user` exists in the throttler — decode JWT manually for identity extraction. Auth guard hasn't run yet.

## Interceptor Order

### bridge-api FHIR endpoints
1. `ConnectionDataInterceptor` — validates `ConnectionId` header, loads connection from Redis, sets `request.connectionData`
2. `FhirCacheInterceptor` — checks cache (pre-handler), caches response (post-handler)
3. `FhirResponseInterceptor` (global) — unwraps `{statusCode, data, headers}` format, sets FHIR Content-Type

- Interceptors run in registration order: `@UseInterceptors(A, B)` → A runs first (pre), B runs first (post, via RxJS tap).
- Global interceptors (registered in `main.ts`) run after per-route interceptors.

## Provider Patterns

| Pattern | When to Use | Example |
|---------|-------------|---------|
| Module-level singleton import | Infrastructure packages | `import { cache } from '@hs/cache'` |
| `@Injectable()` + NestJS DI | App-specific services | `PlatformJwksService`, `BridgeClientService` |
| `{ provide: Token, useClass: Class }` | Override defaults | `{ provide: ThrottlerStorage, useClass: RedisThrottleStorage }` |
| `{ provide: Token, useValue: instance }` | Pre-built instances | Core providers module |
| `@Global() @Module()` | Truly shared services | `CoreProvidersModule` in bridge-api |

- Infrastructure singletons (`cache`, `db`, `logger`, `secrets`) are imported directly — no NestJS wrapper needed.
- Only use `@Injectable()` when the service needs NestJS DI features (injection, lifecycle hooks, scope).

## Decorator Usage

| Decorator | Purpose | Applied To |
|-----------|---------|------------|
| `@Public()` | Skip auth guards | Endpoint method |
| `@Roles('OWNER', 'ADMIN')` | Required roles | Endpoint method |
| `@Throttle({ default: { limit, ttl } })` | Per-endpoint rate limit override | Endpoint method or controller class |
| `@CurrentUser()` | Extract `request.user` | Method parameter |
| `@ConnectionData()` | Extract `request.connectionData` | Method parameter |
| `@UseGuards(Guard)` | Apply per-route guard | Controller class or method |
| `@UseInterceptors(Interceptor)` | Apply interceptor | Controller class or method |
| `@ApiTags('tag')` | Swagger grouping | Controller class |
| `@ApiOperation({ summary })` | Swagger description | Endpoint method |
| `@ApiResponse({ status, description })` | Swagger response docs | Endpoint method |

## Validation

- Use `ValidationPipe` globally (registered in `main.ts`):
  ```typescript
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  ```
- `transform: true` — auto-transform payloads to DTO instances.
- `whitelist: true` — strip properties not in the DTO (prevents mass assignment).
- DTOs use class-validator decorators: `@IsString()`, `@IsEnum()`, `@IsOptional()`, `@IsUUID()`.

## Exception Filter

- `GlobalExceptionFilter` is registered in `main.ts` for bridge-api.
- Maps all exceptions to FHIR `OperationOutcome` format.
- Logs full error server-side, returns sanitized error to client.
- Admin-api uses NestJS default exception filter (standard JSON error format).

## Middleware

- `RequestTimingMiddleware` — applied to all routes (`*`) in every app.
- Logs: method, url, status code, duration in milliseconds.
- Uses `process.hrtime.bigint()` for nanosecond precision.
- Applied via `NestModule.configure()` in `AppModule`.
