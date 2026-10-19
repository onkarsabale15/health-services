import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { cache } from '@hs/infra';
import { createHash } from 'crypto';
import { CacheKeys } from '../../../cache/cache-keys';
import { CacheTTL } from '../../../cache/cache-ttl';

/**
 * Server-side FHIR response cache that respects standard HTTP Cache-Control semantics.
 *
 * Runs AFTER DualAuthGuard (authorization) and ConnectionDataInterceptor,
 * so `request.user` and `request.connectionData` are guaranteed to exist.
 *
 * Cache keys are scoped by the authenticated app identity (`request.user.clientId`),
 * NOT by EHR OAuth credentials — ensuring tenant-level cache isolation.
 *
 * Client request headers:
 *   Cache-Control: max-age=600    → cache response for up to 600s (opt-in)
 *   Cache-Control: no-cache       → bypass any existing cache, fetch fresh from EHR, store result
 *   Cache-Control: no-store       → bypass cache AND don't store the response
 *   (no header)                   → NO caching — always fetch from EHR (default)
 *
 * Server response headers (set on all FHIR GET responses):
 *   Cache-Control: max-age=<ttl>  → how long the response is cacheable
 *   ETag: "<hash>"                → content hash for conditional requests
 *
 * Client conditional request:
 *   If-None-Match: "<etag>"       → return 304 Not Modified if ETag matches
 *
 * Write operations (POST/PUT/DELETE):
 *   Invalidate all cached entries for the affected resource type.
 */
@Injectable()
export class FhirCacheInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = request.method?.toUpperCase();

    // Require both auth identity and integration config — refuse to cache without them
    const user = request.user;
    const integrationConfig = request.siteData;
    if (!user || !integrationConfig?.ehrName) return next.handle();

    // Use the authenticated app's clientId for tenant-scoped cache isolation
    const tenantId = user.clientId || user.appId || user.organizationId;
    if (!tenantId) return next.handle();

    const ehrName = integrationConfig.ehrName;
    const siteId = integrationConfig.siteId;
    const resourceType = this.extractResourceType(request);
    if (!resourceType) return next.handle();

    const resourceId: string | undefined = request.params?.id;

    if (method !== 'GET') {
      return this.handleWrite(next, tenantId, ehrName, siteId, resourceType);
    }

    const directives = this.parseCacheControl(request.headers['cache-control']);

    // No Cache-Control header = no caching (default: always fetch from EHR)
    if (!request.headers['cache-control']) {
      return next.handle();
    }

    if (directives.noCache || directives.noStore) {
      return this.handleBypass(
        next,
        response,
        directives,
        tenantId,
        ehrName,
        siteId,
        resourceType,
        resourceId,
        request.query,
      );
    }

    const ttl = this.resolveTtl(directives, resourceId);
    const cacheKey = this.buildKey(tenantId, ehrName, siteId, resourceType, resourceId, request.query);

    return this.handleGet(next, request, response, cacheKey, ttl, directives);
  }

  private handleWrite(
    next: CallHandler,
    tenantId: string,
    ehrName: string,
    siteId: string,
    resourceType: string,
  ): Observable<any> {
    return next.handle().pipe(
      tap(async () => {
        try {
          await cache.delByPattern(CacheKeys.appEhrSiteResourcePattern(tenantId, ehrName, siteId, resourceType));
        } catch {
          // Non-fatal
        }
      }),
    );
  }

  private handleBypass(
    next: CallHandler,
    response: any,
    directives: CacheDirectives,
    tenantId: string,
    ehrName: string,
    siteId: string,
    resourceType: string,
    resourceId: string | undefined,
    query: Record<string, any>,
  ): Observable<any> {
    return next.handle().pipe(
      tap(async (result) => {
        if (!result) return;

        const etag = this.computeEtag(result);
        response.setHeader('ETag', `"${etag}"`);
        response.setHeader('Cache-Control', 'no-cache');

        if (!directives.noStore) {
          const ttl = this.resolveTtl(directives, resourceId);
          const key = this.buildKey(tenantId, ehrName, siteId, resourceType, resourceId, query);
          try {
            await cache.set(key, { data: result, etag }, ttl);
          } catch {
            // Non-fatal
          }
        }
      }),
    );
  }

  private async handleGet(
    next: CallHandler,
    request: any,
    response: any,
    cacheKey: string,
    ttl: number,
    directives: CacheDirectives,
  ): Promise<Observable<any>> {
    try {
      const cached = await cache.get<{ data: any; etag: string }>(cacheKey);
      if (cached) {
        const clientEtag = request.headers['if-none-match']?.replace(/"/g, '');
        if (clientEtag && clientEtag === cached.etag) {
          response.status(304);
          response.setHeader('ETag', `"${cached.etag}"`);
          response.setHeader('Cache-Control', `max-age=${ttl}`);
          return of(undefined);
        }

        response.setHeader('ETag', `"${cached.etag}"`);
        response.setHeader('Cache-Control', `max-age=${ttl}`);
        response.setHeader('X-Cache', 'HIT');
        return of(cached.data);
      }
    } catch {
      // Cache miss
    }

    return next.handle().pipe(
      tap(async (result) => {
        if (!result) return;

        const etag = this.computeEtag(result);
        response.setHeader('ETag', `"${etag}"`);
        response.setHeader('Cache-Control', `max-age=${ttl}`);
        response.setHeader('X-Cache', 'MISS');

        if (!directives.noStore) {
          try {
            await cache.set(cacheKey, { data: result, etag }, ttl);
          } catch {
            // Non-fatal
          }
        }
      }),
    );
  }

  private extractResourceType(request: any): string | null {
    const urlPath = request.route?.path || request.url;
    const match = urlPath.match(/fhir\/r4\/v1\/(\w+)/);
    return match ? match[1] : null;
  }

  private buildKey(
    tenantId: string,
    ehrName: string,
    siteId: string,
    resourceType: string,
    resourceId: string | undefined,
    query: Record<string, any>,
  ): string {
    return resourceId
      ? CacheKeys.fhirResource(tenantId, ehrName, siteId, resourceType, resourceId)
      : CacheKeys.fhirSearch(tenantId, ehrName, siteId, resourceType, this.hashQuery(query));
  }

  private resolveTtl(directives: CacheDirectives, resourceId: string | undefined): number {
    if (directives.maxAge !== undefined) return directives.maxAge;
    return resourceId ? CacheTTL.FHIR_RESOURCE : CacheTTL.FHIR_SEARCH;
  }

  private parseCacheControl(header: string | undefined): CacheDirectives {
    if (!header) return {};
    const directives: CacheDirectives = {};
    if (header.includes('no-cache')) directives.noCache = true;
    if (header.includes('no-store')) directives.noStore = true;
    const maxAgeMatch = header.match(/max-age=(\d+)/);
    if (maxAgeMatch) directives.maxAge = parseInt(maxAgeMatch[1], 10);
    return directives;
  }

  private hashQuery(query: Record<string, any>): string {
    const sorted = JSON.stringify(query, Object.keys(query).sort());
    return createHash('md5').update(sorted).digest('hex').substring(0, 12);
  }

  private computeEtag(data: any): string {
    const serialized = JSON.stringify(data);
    return createHash('md5').update(serialized).digest('hex');
  }
}

interface CacheDirectives {
  noCache?: boolean;
  noStore?: boolean;
  maxAge?: number;
}
