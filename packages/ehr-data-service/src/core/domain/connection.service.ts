import { v7 as uuidv7 } from 'uuid';
import { cache } from '@hs/infra';
import { resolveEndpoints, isProdDeployment } from '@hs/config';
import { IConnectionService } from '../interfaces/connection-service.interface';
import { tokenService } from './token.service';
import { ehrFactory } from './ehr-factory.service';
import { AppError } from '../errors/app.error';
import { ConnectionData } from '../interfaces/connection-data.interface';

const CONNECTION_CACHE_TTL = 1200;

class ConnectionService implements IConnectionService {
  async createConnection(
    payload: Record<string, unknown>,
    authContext?: Record<string, unknown>,
  ): Promise<ConnectionData> {
    // ── Resolve all endpoints upfront (payload overrides > centralized defaults) ──
    // Deployment env (cert/prod) determines which side of the catalog we use.
    const ehrName = payload.ehrName as string;
    const appType = (payload.appType as string) || 'system';
    const isProd = isProdDeployment();
    const resolved = resolveEndpoints(ehrName, appType, payload);

    // Pick the deployment-env side of the catalog for base + auth URLs.
    // A single-value `baseUrl`/`authUrl` override in the payload wins over the catalog.
    const envSuffix = isProd ? 'Prod' : 'Test';
    const resolvedBaseUrl =
      (payload.baseUrl as string) ||
      (resolved[`baseUrl${envSuffix}`] as string) ||
      (resolved.baseUrlTest as string) ||
      null;
    const resolvedAuthUrl =
      (payload.authUrl as string) ||
      (resolved[`authUrl${envSuffix}`] as string) ||
      (resolved.authUrlTest as string) ||
      null;

    // Resolve extra URLs (tokenUrl, fhirBaseUrl, etc.) — pick deployment-env side per extra key.
    const standardKeys = new Set(['baseUrlTest', 'baseUrlProd', 'authUrlTest', 'authUrlProd']);
    const resolvedExtraUrls: Record<string, string> = {};
    const seenBases = new Set<string>();
    for (const key of Object.keys(resolved)) {
      if (standardKeys.has(key) || !resolved[key]) continue;
      const baseName = key.replace(/(?:Test|Prod)$/, '');
      if (seenBases.has(baseName)) continue;
      seenBases.add(baseName);
      const val =
        (payload[baseName] as string) ||
        (resolved[`${baseName}${envSuffix}`] as string) ||
        (resolved[`${baseName}Test`] as string) ||
        (resolved[baseName] as string) ||
        null;
      if (val) resolvedExtraUrls[baseName] = val;
    }

    // Check cache first - return existing connection if token is cached
    const cachedToken = (await tokenService.getAccessToken(payload)) as ConnectionData | null;
    if (cachedToken) {
      return { ...cachedToken, cached: true } as unknown as ConnectionData;
    }

    // Fetch token from the EHR vendor's own getToken method
    const ehrService = ehrFactory.getService(ehrName);
    const tokenResult = await ehrService.getToken(payload, authContext?.secrets);

    if (!tokenResult?.accessToken) {
      throw new AppError(502, `Failed to obtain access token from ${ehrName}`);
    }

    // Build connection data — includes ALL credentials and resolved URLs for cache
    const connectionId = uuidv7();
    const connectionData: ConnectionData = {
      connectionId,
      ehrName,
      ...payload,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      expiresIn: tokenResult.expiresIn,
      // Pre-resolved URLs — vendor services read these directly from cache
      resolvedBaseUrl: resolvedBaseUrl || undefined,
      resolvedAuthUrl: resolvedAuthUrl || undefined,
      ...(Object.keys(resolvedExtraUrls).length > 0 ? { resolvedExtraUrls } : {}),
    };

    // Cache the token and connection (all credentials + URLs + token in one object)
    await tokenService.cacheToken(payload, connectionData, tokenResult.expiresIn);
    await tokenService.cacheConnection(connectionId, connectionData);

    return connectionData;
  }

  async getConnection(connectionId: string): Promise<ConnectionData> {
    const connectionData = (await cache.getAndExtend(connectionId, CONNECTION_CACHE_TTL)) as ConnectionData | null;
    if (!connectionData) {
      throw new AppError(401, 'Invalid Connection Id');
    }
    return connectionData;
  }

  async deleteConnection(connectionId: string, _connectionData?: unknown): Promise<void> {
    await cache.del(connectionId);
  }
}

export const connectionService = new ConnectionService();
