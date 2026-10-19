# TypeScript Rules

## Type Safety

- **`any` is banned at interface boundaries.** Use proper types for:
  - Function parameters and return values
  - Public API exports from packages
  - Interface and abstract class definitions
  - Controller method signatures
- **`any` is tolerated inside implementation** only when interfacing with untyped external libraries — add a comment explaining why.
- **`as any` casts must be justified** with a comment. Every `as any` is tech debt to be resolved.
- **Use union types** for known variants:
  ```typescript
  // Good
  appType: 'BRIDGE' | 'CDS' | 'CUSTOM'

  // Bad
  appType: string
  ```
- **Use `unknown` instead of `any`** when the type is genuinely unknown — forces callers to narrow.

## Generics — Write Once, Type Safely Everywhere

Use generics when the same logic applies to multiple types. Generics preserve type safety across call sites — callers get full autocomplete and type errors without the library having to know their specific type.

### When to use generics

- **Shared infrastructure:** cache, storage, HTTP clients, repositories, event emitters.
- **Mappers/transformers:** functions that convert `T` → `U` without caring about the shape of `T`.
- **Wrappers:** functions that decorate behavior (retry, timeout, logging) around any operation.
- **Collections:** anything that holds, filters, or maps items of an unknown type.

### When NOT to use generics

- **Domain logic with a fixed shape** — use a concrete interface.
- **Single-use functions** — don't pre-generalize "just in case".
- **When a discriminated union would be clearer** — prefer explicit variants.

### Patterns to follow

**1. Default to `unknown`, constrain when needed:**
```typescript
// Good — caller specifies the type, gets it back fully typed
async get<T = unknown>(key: string): Promise<T | null>
const user = await cache.get<User>('user:123');  // typed as User | null

// Good — constrain to ensure T has required fields
function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}

// Bad — loses type info at call site
async get(key: string): Promise<any>
```

**2. Propagate generics through wrappers:**
```typescript
// Good — return type flows through
async function withRetry<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn(); } catch (e) { if (i === maxRetries - 1) throw e; }
  }
  throw new Error('unreachable');
}
const result = await withRetry(() => fetchUser(id), 3); // typed as User

// Bad — return type forgotten
async function withRetry(fn: () => Promise<any>, maxRetries: number): Promise<any>
```

**3. Use generic constraints to enforce shape:**
```typescript
// Good — T must extend FhirResource
interface FhirRepository<T extends FhirResource> {
  create(resource: T): Promise<T>;
  read(id: string): Promise<T | null>;
  search(params: Record<string, string>): Promise<T[]>;
}

// Good — narrow by resourceType
function isResourceType<T extends { resourceType: string }>(
  resource: unknown,
  resourceType: string,
): resource is T {
  return typeof resource === 'object' && resource !== null
    && (resource as any).resourceType === resourceType;
}
```

**4. Multiple generic params for mappers:**
```typescript
// Good — explicit input/output types
function mapAll<TIn, TOut>(items: TIn[], mapper: (item: TIn) => TOut): TOut[] {
  return items.map(mapper);
}

// Good — async mappers
async function mapParallel<TIn, TOut>(
  items: TIn[],
  mapper: (item: TIn) => Promise<TOut>,
): Promise<TOut[]> {
  return Promise.all(items.map(mapper));
}
```

**5. Derive types from values with `typeof` + `Awaited`:**
```typescript
// Good — type flows automatically from Prisma client
const prisma = db.getClient();
type CarePlan = Awaited<ReturnType<typeof prisma.carePlan.findFirst>>;

// Good — config object drives type
const APP_TYPES = { BRIDGE: {...}, CDS: {...}, WORKFLOW: {...} } as const;
type AppType = keyof typeof APP_TYPES; // 'BRIDGE' | 'CDS' | 'WORKFLOW'
```

**6. React component generics:**
```typescript
// Good — one component handles multiple item types
interface TableProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderRow: (item: T) => ReactNode;
}
function Table<T>({ items, getKey, renderRow }: TableProps<T>) {
  return <tbody>{items.map(i => <tr key={getKey(i)}>{renderRow(i)}</tr>)}</tbody>;
}
<Table items={patients} getKey={p => p.id} renderRow={p => <td>{p.name}</td>} />
```

**7. Generic hooks:**
```typescript
// Good — hook works for any fetcher
function useAsyncData<T>(fetcher: () => Promise<T>): { data: T | null; loading: boolean; error: string } {
  // ... single implementation, typed for every caller
}
const { data: plans } = useAsyncData(() => cdsApi.getCarePlans());  // typed as CarePlan[] | null
```

### Anti-patterns to avoid

| Anti-pattern | Correct approach |
|-------------|-----------------|
| `function foo(x: any): any` | `function foo<T>(x: T): T` |
| `const result = fn() as MyType` (unsafe cast) | Pass `MyType` as generic: `fn<MyType>()` |
| Returning `Record<string, unknown>` from a generic service | Return `T` so callers keep their types |
| `useState<any>(null)` | `useState<T \| null>(null)` with explicit `T` |
| Over-constraining: `<T extends object>` when you don't read properties | Just use `<T>` — constraints should be semantic |
| Generic params without use: `function<T>(s: string): string` | Remove the unused generic |

### Naming
- Single letter for simple cases: `<T>`, `<K, V>`, `<T, U>`.
- Descriptive when meaning is unclear: `<TRequest, TResponse>`, `<TInput, TOutput>`, `<TNode extends Node>`.
- Domain-specific when applicable: `<TResource extends FhirResource>`.

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | `kebab-case.ts` | `throttle-tracker.ts`, `cache-keys.ts` |
| Classes | `PascalCase` | `RedisThrottleStorage`, `SessionGuard` |
| Interfaces (infra) | `I` prefix + `PascalCase` | `ICache`, `ILogger`, `IHttpClient` |
| Interfaces (domain) | `PascalCase` (no prefix) | `ConnectionData`, `AuthUser`, `CdsCard` |
| Functions/methods | `camelCase` | `identityTracker`, `getAppEhrConfig` |
| Constants (true) | `UPPER_SNAKE_CASE` | `FHIR_CONTENT_TYPE`, `JWT_ALGORITHM` |
| Constants (config objects) | `camelCase` | `AdminCacheKeys`, `BridgeCacheTTL` |
| Enums | `PascalCase` name, `UPPER_CASE` values | `enum AppType { BRIDGE, CDS }` |
| Type aliases | `PascalCase` | `type EhrPayload = EpicPayload \| CernerPayload` |
| Generic params | Single uppercase letter | `<T>`, `<T extends Resource>` |

## Import Rules

- **Shared packages:** `import { x } from '@hs/package'` — never import from internal paths like `@hs/cache/src/redis-cache`.
- **Internal imports:** Relative paths: `'../../guards/session.guard'`.
- **No circular imports.** If A imports B and B imports A, extract shared types to a third module.
- **Import order** (enforce via linter):
  1. Node built-ins (`crypto`, `path`)
  2. External packages (`@nestjs/*`, `ioredis`, `jose`)
  3. Workspace packages (`@hs/cache`, `@hs/core`)
  4. Relative imports (`./`, `../../`)
- **No barrel re-exports in apps.** Only packages use `index.ts` for public API.

## Async/Await Rules

- **Always `await` operations that must complete before proceeding.**
  ```typescript
  // Good — state-critical, must complete
  await cache.set(stateKey, stateData, TTL);

  // Acceptable — non-critical, fire-and-forget with comment
  cache.del(oldKey).catch(() => {}); // best-effort cleanup
  ```
- **Use `Promise.all()` for independent parallel operations:**
  ```typescript
  // Good
  const [apps, users] = await Promise.all([
    prisma.application.findMany({ where }),
    prisma.user.findMany({ where }),
  ]);

  // Bad — sequential for no reason
  const apps = await prisma.application.findMany({ where });
  const users = await prisma.user.findMany({ where });
  ```
- **Use `Promise.race()` with timeout** for operations that could hang:
  ```typescript
  const result = await Promise.race([
    this.waitForToken(connectionId),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10_000)),
  ]);
  ```
- **Never `await` inside a loop** if iterations are independent:
  ```typescript
  // Good
  await Promise.all(items.map(item => processItem(item)));

  // Bad
  for (const item of items) {
    await processItem(item);
  }
  ```

## Code Reuse

- **Extract shared logic into services.** If the same data assembly, validation, or business logic appears in more than one place (controller + service, two services, etc.), extract it into a dedicated service class and inject it via NestJS DI.
- **Static helpers for pure logic.** Stateless operations (title generation, key building, data formatting) belong as static methods on the service class or standalone exported functions.
- **Before writing new code, grep for existing implementations.** Use `Grep` to search for function names, patterns, or field names before creating new ones.
- **One source of truth for data assembly.** If a DB record needs fields from multiple sources (cache, session, request body), build it in ONE service method — never duplicate the assembly logic across controller + background job.
- **Frontend: shared components over inline markup.** If the same UI pattern (card, table, badge, modal) appears in 2+ pages, extract to `src/components/`.

## Code Style

- Simple, readable code matching integration-engine patterns.
- Prefer explicit over clever. Three clear lines > one cryptic one-liner.
- No unnecessary abstractions. Don't create a factory for something instantiated once.
- No premature optimization. Profile first, optimize second.
- Comments explain **why**, not **what**. The code explains what.
- Max function length: ~50 lines. If longer, extract helper functions.
- Max file length: ~300 lines for components/controllers. Split at logical boundaries.
- Prefer `const` over `let`. Never use `var`.
- Use template literals for string interpolation: `` `key:${id}` `` not `'key:' + id`.
- Use optional chaining: `user?.role` not `user && user.role`.
- Use nullish coalescing: `value ?? default` not `value || default` (preserves `0`, `''`, `false`).
