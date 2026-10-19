# Monorepo Rules (Turborepo + npm Workspaces)

## Package Boundaries

- `apps/` depend on `packages/` — **never the reverse.**
- `packages/` can depend on other packages (e.g., `@hs/core` → `@hs/cache`, `@hs/http-client`).
- **No circular dependencies** between packages. If A imports B and B imports A, extract shared types to C.
- Each package exports from a single `src/index.ts` entry point — consumers never import from internal paths.

### Dependency Direction
```
apps/admin-api  ─→  @hs/core  ─→  @hs/cache
apps/bridge-api ─→  @hs/core  ─→  @hs/http-client
apps/cds-app    ─→  @hs/cds-engine (zero infra deps)
apps/admin-ui   ─→  @hs/config (types only)

Never: @hs/cache ─→ apps/admin-api (package depending on app)
Never: @hs/core ←→ @hs/db (circular)
```

## Package Categories

### Infrastructure Packages (singleton + lazy init pattern)
`cache`, `logger`, `db`, `secrets`, `storage`, `http-client`, `tracing`

```typescript
class XyzService implements IXyz {
  private initialized = false;
  init(config?: XyzConfig): void { /* setup */ }
  private ensureInitialized(): void { if (!this.initialized) this.init(); }
  async doThing(): Promise<T> { this.ensureInitialized(); /* ... */ }
}
export const xyz: IXyz & { init: (...) => void } = new XyzService();
```

### Domain Packages (classes, functions, types)
`core`, `config`, `ehr-data-service`, `cds-engine`

- Export interfaces, services, factories, constants.
- No singleton instances — consumers instantiate or register as needed.

### Rules for Shared Packages
- **Every package must build independently:** `npx turbo build --filter=@hs/{package}` must succeed.
- **No app-specific code in packages.** If it's only used by one app, it belongs in that app's `src/`.
- **No side effects on import.** Initialization happens explicitly via `.init()` or at app startup.
- **Package-level `tsconfig.json`** extends `../../tsconfig.base.json`.

## Dependency Management

- All packages use workspace references: `"@hs/cache": "*"` (resolved by npm workspaces).
- External dependencies are declared in **each package's** `package.json`, not hoisted to root.
- Root `package.json` only has `turbo` and `typescript` as devDependencies.
- **No duplicate external dependencies** across packages at different versions — use same version.
- Regularly audit for unused dependencies: `npm ls`, grep for imports, check `package.json`.
- Lock file (`package-lock.json`) is committed — ensures reproducible builds.

## Build & CI

### Turbo Pipeline
```jsonc
// turbo.json
{
  "tasks": {
    "build": { "dependsOn": ["^build", "db:generate"] },
    "db:generate": { "cache": false },
    "dev": { "dependsOn": ["^build"], "persistent": true },
    "test": { "dependsOn": ["build"] }
  }
}
```

- `^build` = topological dependency (packages build before apps).
- `db:generate` = Prisma client generation, runs before every build, not cached.
- `turbo build` builds all 15+ packages with dependency ordering and caching.

### Build Requirements
- **Build must pass with zero errors before merging.** Warnings are tolerated but should be addressed.
- **No `console.log` in production code** — enforce via ESLint `no-console` rule.
- All apps must compile: `npx turbo build` → all tasks green.

### Scripts
```json
{
  "build": "turbo run build",
  "dev": "turbo run dev --concurrency 25",
  "lint": "turbo run lint",
  "test": "turbo run test",
  "clean": "turbo run clean"
}
```

## Adding a New Package

1. Create `packages/{name}/` with `package.json`, `tsconfig.json`, `src/index.ts`.
2. Name: `@hs/{name}` in `package.json`.
3. Add to consuming app's `package.json`: `"@hs/{name}": "*"`.
4. Run `npm install` from root to link workspaces.
5. Verify: `npx turbo build --filter=@hs/{name}` succeeds.
6. Export public API from `src/index.ts` only.

## Adding a New App

1. Create `apps/{name}/` with standard NestJS or Next.js scaffold.
2. Name: `@hs/{name}` in `package.json`.
3. Add shared package dependencies: `"@hs/cache": "*"`, etc.
4. Follow initialization order in `main.ts`: tracing → logger → secrets → cache → db → http-client → NestFactory.
5. Verify: `npx turbo build --filter=@hs/{name}` succeeds.
