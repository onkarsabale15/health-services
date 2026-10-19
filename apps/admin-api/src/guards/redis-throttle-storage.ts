import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { cache } from '@hs/infra';

/**
 * Redis-backed ThrottlerStorage for centralized rate limiting.
 *
 * Uses Redis counters with TTL for sliding window rate limiting.
 * Supports blocking (lockout after limit exceeded).
 *
 * Key structure (all under `throttle:` namespace):
 *   throttle:{key}          — hit counter with TTL = window size
 *   throttle:blocked:{key}  — block flag with TTL = blockDuration
 *
 * Centralized: all service instances share the same Redis counters,
 * so rate limits are enforced globally, not per-instance.
 */
@Injectable()
export class RedisThrottleStorage implements ThrottlerStorage {
  async increment(
    key: string,
    ttl: number, // milliseconds
    limit: number,
    blockDuration: number, // milliseconds
    _throttlerName: string,
  ): Promise<{ totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number }> {
    const counterKey = `throttle:${key}`;
    const blockKey = `throttle:blocked:${key}`;

    // 1. Check if currently blocked
    const blocked = await cache.get(blockKey);
    if (blocked) {
      const blockTtl = await cache.pttl(blockKey);
      return {
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.max(0, blockTtl),
      };
    }

    // 2. Atomic increment with TTL (seconds, rounded up)
    const ttlSeconds = Math.ceil(ttl / 1000);
    const totalHits = await cache.incr(counterKey, ttlSeconds);

    // 3. Get remaining TTL
    const remainingMs = await cache.pttl(counterKey);

    // 4. Block if over limit and blockDuration is set
    let isBlocked = false;
    let timeToBlockExpire = 0;

    if (totalHits > limit && blockDuration > 0) {
      const blockSeconds = Math.ceil(blockDuration / 1000);
      await cache.set(blockKey, 1, blockSeconds);
      isBlocked = true;
      timeToBlockExpire = blockDuration;
    }

    return {
      totalHits,
      timeToExpire: Math.max(0, remainingMs),
      isBlocked,
      timeToBlockExpire,
    };
  }
}
