# Testing Rules

## What to Test

### Must Test
- Domain logic: validators, mappers, utility functions, cache key builders
- Business rules: access control logic, scope resolution, token validation
- Error paths: invalid input returns proper error codes, edge cases handled
- Integration: API endpoints with test DB, guard chains, interceptor pipelines

### Should Test
- Service methods with branching logic
- Custom decorators and pipes
- Cache invalidation chains
- EHR vendor-specific field mapping

### Don't Test
- Simple CRUD controllers with no logic (covered by integration tests)
- Configuration files and constants
- Type definitions and interfaces
- Third-party library wrappers with no custom logic
- Prisma schema (tested by migration)

## Test Patterns

### Arrange-Act-Assert (AAA)
```typescript
describe('identityTracker', () => {
  it('should extract userId from session JWT', () => {
    // Arrange
    const req = {
      headers: { authorization: 'Bearer eyJ...' },
      ip: '127.0.0.1',
    };

    // Act
    const result = identityTracker(req);

    // Assert
    expect(result).toBe('user:abc-123');
  });
});
```

### Mocking External Dependencies
```typescript
// Mock @hs/cache
jest.mock('@hs/cache', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getdel: jest.fn(),
  },
}));

// Mock @hs/db
jest.mock('@hs/db', () => ({
  db: {
    getClient: () => ({
      application: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    }),
  },
}));
```

- **Never hit real services in unit tests** — mock Redis, Prisma, HTTP, Secrets.
- **Use real instances in integration tests** — test DB, test Redis (via Docker Compose).

### Test Data Factories
```typescript
// test/factories.ts
export function createTestApplication(overrides?: Partial<Application>): Application {
  return {
    id: randomUUID(),
    name: 'Test App',
    clientId: `client_${randomUUID().slice(0, 8)}`,
    status: 'ACTIVE',
    appType: 'BRIDGE',
    organizationId: randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
```

- Never hardcode UUIDs, timestamps, or specific values.
- Use factory functions with override support for test-specific values.

### Testing Error Paths
```typescript
it('should return 401 when token is expired', async () => {
  const response = await request(app.getHttpServer())
    .get('/applications')
    .set('Authorization', 'Bearer expired-token');

  expect(response.status).toBe(401);
  expect(response.body.message).toBe('Invalid or expired token');
});

it('should return 403 when user lacks OWNER role', async () => {
  const response = await request(app.getHttpServer())
    .delete('/applications/123')
    .set('Authorization', `Bearer ${viewerToken}`);

  expect(response.status).toBe(403);
});
```

## Naming Conventions

- Test files: `{module}.spec.ts` (unit) or `{module}.e2e-spec.ts` (integration).
- Test suites: `describe('{ClassName}' or '{functionName}')`.
- Test cases: `it('should {expected behavior} when {condition}')`.
- Examples:
  - `should return 401 when token is expired`
  - `should extract clientId from Basic auth header`
  - `should invalidate cache when application is updated`
  - `should return FHIR OperationOutcome for 404`

## Test Organization

```
apps/{app}/
  test/
    e2e/
      auth.e2e-spec.ts
      application.e2e-spec.ts
    unit/
      guards/
        session.guard.spec.ts
        throttle-tracker.spec.ts
      cache/
        cache-keys.spec.ts

packages/{package}/
  src/
    __tests__/
      {module}.spec.ts
```

## Coverage Goals

- Critical paths (auth, token, rate limiting): 90%+
- Business logic (services, validators): 80%+
- Infrastructure wrappers: 50%+ (mostly integration)
- Overall: 70%+ before production launch
