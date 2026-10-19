import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { getRouteScope } from '@hs/config';

/**
 * ScopeGuard checks platform JWT tokens for FHIR scope authorization.
 * Only applies to platform tokens (isPlatformToken=true).
 * API-key auth bypasses this guard (legacy behavior).
 *
 * Derives the required scope from the request method + path using @hs/config route registry.
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Only enforce scopes for platform OAuth tokens
    if (!user?.isPlatformToken) return true;

    const method = request.method;
    const path = request.route?.path || request.path;

    // Derive required scope from route registry
    const entry = getRouteScope(method, path);
    if (!entry) {
      // Route not in registry — allow (could be non-FHIR route like connection)
      return true;
    }

    const grantedScopes = user.scope ? user.scope.split(' ') : [];
    if (!grantedScopes.includes(entry.scope)) {
      throw new ForbiddenException({
        error: 'insufficient_scope',
        error_description: `Required scope: ${entry.scope}`,
        scope: entry.scope,
      });
    }

    // Also check EHR-level scope: the connection's EHR must be allowed
    const connectionData = request.connectionData;
    if (connectionData?.ehrName && user.ehrAccess) {
      const ehrScopes = user.ehrAccess[connectionData.ehrName];
      if (!ehrScopes || !ehrScopes.includes(entry.scope)) {
        throw new ForbiddenException({
          error: 'insufficient_scope',
          error_description: `Scope ${entry.scope} not granted for EHR ${connectionData.ehrName}`,
        });
      }
    }

    return true;
  }
}
