import { createHash } from 'node:crypto';

// ─── Cache Key Helper ────────────────────────────────────────────────────────
//
// Deterministic cache key builder shared across every app. Keeps the
// namespace structure consistent (RedisInsight groups by `:`) and removes
// per-app copies of the SHA1(JSON.stringify(args)) dance.
//
// Key shape:
//
//     <namespace>:<operation>:<hash>
//
// Where `<hash>` is a 16-char hex slice of SHA-1 over the stable JSON form
// of the arguments. 16 hex chars = 64 bits of entropy, more than enough to
// keep collisions astronomically unlikely while keeping keys short enough
// to read at a glance in RedisInsight.
//
// Stable JSON: we recursively sort object keys before hashing, so the
// order the caller passes arguments doesn't affect the key. Arrays keep
// their order (positional semantics matter for e.g. pagination cursors).

export interface CacheKeyInput {
  /** Top-level namespace — e.g. 'bridge:terminology', 'cds:terminology' */
  namespace: string;

  /** Operation name — e.g. 'search', 'lookup', 'findMany' */
  operation: string;

  /** Any JSON-serializable arguments to include in the hash */
  args: unknown;
}

/**
 * Build a namespaced, hashed cache key. Use this for every cache entry so
 * collisions across services, operations, or environments are impossible.
 */
export function buildCacheKey({ namespace, operation, args }: CacheKeyInput): string {
  const hash = createHash('sha1').update(stableStringify(args)).digest('hex').slice(0, 16);
  return `${namespace}:${operation}:${hash}`;
}

// ─── Internal: stable JSON serialization ─────────────────────────────────────

function stableStringify(value: unknown): string {
  return JSON.stringify(value, replacer);
}

/**
 * `JSON.stringify` replacer that sorts object keys. Arrays are passed
 * through unchanged because argument order matters for array inputs
 * (cursors, positional parameters, ordered lists).
 */
function replacer(_key: string, value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[k] = (value as Record<string, unknown>)[k];
  }
  return sorted;
}
