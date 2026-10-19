export interface ITokenService {
  getAccessToken(payload: Record<string, unknown>): Promise<unknown>;
  getAndExtend(key: string, ttl: number): Promise<unknown>;
}
