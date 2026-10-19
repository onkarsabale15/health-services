import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { logger } from '@hs/observability';

/**
 * Global interceptor that logs structured audit events for all state-changing
 * requests (POST/PUT/PATCH/DELETE). Runs after guards — request.user is available.
 *
 * Audit entries are ingested by Sentry (structured JSON via Winston → Sentry breadcrumbs).
 * No DB table needed — query via Sentry dashboard.
 *
 * HIPAA: logs actorId, action, resource, but NEVER request/response bodies (may contain PHI).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase();

    // Only audit state-changing operations (reads are covered by request tracing)
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.logAudit(request, context, start),
        error: () => this.logAudit(request, context, start),
      }),
    );
  }

  private logAudit(request: any, context: ExecutionContext, start: bigint): void {
    const response = context.switchToHttp().getResponse();
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    logger.info('audit', {
      // Who
      actorId: request.user?.id || request.user?.appId || 'anonymous',
      actorEmail: request.user?.email,
      actorRole: request.user?.role,
      orgId: request.user?.orgId || request.user?.organizationId,
      // What
      action: `${request.method} ${request.route?.path || request.url}`,
      method: request.method,
      path: request.route?.path,
      // Resource
      resourceType: this.extractResourceType(request.route?.path),
      resourceId: request.params?.id || request.params?.appId || request.params?.userId || request.params?.execId,
      // Result
      statusCode: response.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      // Trace
      ip: request.ip,
    });
  }

  private extractResourceType(routePath?: string): string | undefined {
    if (!routePath) return undefined;
    // Extract primary resource from route: /applications/:id → applications
    const segments = routePath.replace(/^\/+/, '').split('/');
    // Skip 'admin', 'auth', 'internal' prefixes
    const meaningful = segments.find((s) => !s.startsWith(':') && !['admin', 'api', 'v1'].includes(s));
    return meaningful;
  }
}
