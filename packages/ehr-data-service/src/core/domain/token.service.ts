import { cache } from '@hs/infra';
import { ITokenService } from '../interfaces/token-service.interface';
import { AppError } from '../errors/app.error';

const TOKEN_LOCK_TTL = 20;
const CONNECTION_CACHE_TTL = 1200;

class TokenService implements ITokenService {
  async getAccessToken(payload: Record<string, unknown>): Promise<unknown> {
    const cacheKey = this.generateCacheKey(payload);

    // Check cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Try to acquire lock for token refresh
    const lockKey = `${cacheKey}:status`;
    const lockAcquired = await cache.setNx(lockKey, { status: 'REFRESHING' }, TOKEN_LOCK_TTL);

    if (!lockAcquired) {
      // Another request is refreshing, wait for it
      return this.waitForToken(cacheKey, lockKey);
    }

    return null; // Caller needs to fetch token and call cacheToken
  }

  async cacheToken(payload: Record<string, unknown>, tokenData: unknown, expiresIn: number): Promise<void> {
    const cacheKey = this.generateCacheKey(payload);
    const lockKey = `${cacheKey}:status`;

    await cache.set(cacheKey, tokenData, expiresIn);
    await cache.set(lockKey, { status: 'SUCCESS' }, TOKEN_LOCK_TTL);
  }

  async cacheConnection(connectionId: string, connectionData: unknown): Promise<void> {
    await cache.set(connectionId, connectionData, CONNECTION_CACHE_TTL);
  }

  async getAndExtend(key: string, ttl: number): Promise<unknown> {
    return cache.getAndExtend(key, ttl);
  }

  async getConnection(connectionId: string): Promise<unknown> {
    return cache.get(connectionId);
  }

  async deleteConnection(connectionId: string): Promise<void> {
    await cache.del(connectionId);
  }

  private async waitForToken(cacheKey: string, lockKey: string): Promise<unknown> {
    const maxWait = 20000;
    const interval = 500;
    let waited = 0;

    while (waited < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      waited += interval;

      const status = await cache.get<{ status: string }>(lockKey);

      if (status?.status === 'SUCCESS') {
        const token = await cache.get(cacheKey);
        if (token) return token;
      }

      if (status?.status === 'FAILED') {
        throw new AppError(500, 'Token refresh failed');
      }
    }

    throw new AppError(408, 'Token refresh timeout');
  }

  private generateCacheKey(payload: Record<string, unknown>): string {
    const parts = [
      payload.ehrName as string,
      payload.clientId as string,
      (payload.accountId as string) || (payload.tenant as string),
      payload.appType as string,
    ]
      .filter(Boolean)
      .join(':');
    return `token:${parts}`;
  }
}

export const tokenService = new TokenService();
