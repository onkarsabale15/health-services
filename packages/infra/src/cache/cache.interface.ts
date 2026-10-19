export interface ICache {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  delByPattern(pattern: string): Promise<number>;
  setNx(key: string, value: unknown, ttlSeconds?: number): Promise<boolean>;
  getAndExtend<T = unknown>(key: string, ttlSeconds: number): Promise<T | null>;
  getdel<T = unknown>(key: string): Promise<T | null>;
  incr(key: string, ttlSeconds?: number): Promise<number>;
  pttl(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  expireAt(key: string, timestamp: number): Promise<void>;
  flushAll(): Promise<void>;

  /**
   * Read-through helper: return the cached value if present, otherwise run
   * `factory()`, store its result with `ttlSeconds`, and return it.
   *
   * Cache failures (get or set) are swallowed — the factory result is
   * always returned so callers never fail because of cache issues.
   *
   * `null` and `undefined` factory results are NOT cached — `get` can't
   * distinguish a missing key from a cached null. If you need negative
   * caching, wrap values in a sentinel object (`{ found: false }`).
   */
  getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T>;
}

export interface IDistributedLock {
  acquire(key: string, ttlSeconds: number): Promise<boolean>;
  release(key: string): Promise<void>;
}
