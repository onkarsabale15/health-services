import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { platformJwks } from '@hs/infra';
import { SessionContextService } from '../executor/session-context.service';

/** Platform OAuth issuer — mirrors bridge-api's `PLATFORM_ISSUER`. */
const PLATFORM_ISSUER = process.env.OAUTH_ISSUER || 'http://localhost:3002';

/** App type the platform mints for MCP server clients (system / client_credentials). */
const MCP_APP_TYPE = 'MCP';

/**
 * MCP session resolved by the transport's auth layer.
 *
 * Carries identity + the canonical scope (`siteId`). Vendor name (`ehrName`)
 * is NOT here: it's a property of the site, derived via
 * `SessionContextService.resolve(siteId)`, so siteId/ehrName can never
 * disagree. Single source of truth wins.
 */
export interface ResolvedSession {
  /** EhrSiteConfig.id — the canonical scope. Everything else flows from this. */
  siteId: string;
  /** Application id (token `sub`). */
  applicationId: string;
  /** Owning organization (token `org_id`). */
  organizationId: string;
  /** OAuth client id of the calling application. */
  clientId?: string;
}

/**
 * Authenticates + authorizes an MCP request, mirroring how bridge-api guards a
 * system (client_credentials) call:
 *
 * 1. Verify the `Authorization: Bearer` API token against the platform JWKS
 *    (shared `@hs/infra` verifier — same primitive bridge-api uses). Rejects
 *    bad signature / issuer / audience / expiry, and non-`api` token types.
 * 2. Require `app_type === 'MCP'` — MCP tokens are minted only for MCP apps,
 *    and bridge-api conversely rejects MCP tokens (its allow-list excludes it).
 * 3. Require an `X-Site-Id` header — the canonical scope (same header bridge
 *    uses for system apps).
 * 4. Resolve the site (memoized) → tenant-boundary check (`org_id` must match
 *    the site's owning org) + grant check (the app's `ehr_access` must include
 *    the site's vendor).
 *
 * The site here is NOT trusted from the client: it's loaded from admin-api and
 * checked against the token's org + granted EHRs, so a leaked site id can't be
 * driven by a token from a different tenant.
 */
@Injectable()
export class McpAuthService {
  constructor(private readonly sessionContext: SessionContextService) {}

  async authenticate(bearer: string | undefined, siteId: string | undefined): Promise<ResolvedSession> {
    if (!bearer) {
      throw new UnauthorizedException('Missing or invalid bearer token');
    }
    if (!siteId) {
      throw new UnauthorizedException('X-Site-Id header is required');
    }

    let claims;
    try {
      claims = await platformJwks.verifyApiToken(bearer, { issuer: PLATFORM_ISSUER });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (claims.app_type !== MCP_APP_TYPE) {
      throw new UnauthorizedException(`App type '${claims.app_type}' is not authorized for the MCP server`);
    }

    // Resolve the site (memoized) → vendor + owning org for the boundary checks.
    const { ehrName, organizationId } = await this.sessionContext.resolve(siteId);

    // Tenant isolation: the site must belong to the token's organization.
    if (claims.org_id && organizationId && claims.org_id !== organizationId) {
      throw new UnauthorizedException('Site does not belong to your organization');
    }

    // Grant check: the MCP app must have been granted access to this vendor.
    const ehrAccess = Array.isArray(claims.ehr_access) ? claims.ehr_access : [];
    if (!ehrAccess.includes(ehrName)) {
      throw new ForbiddenException(`Application is not granted access to EHR '${ehrName}'`);
    }

    return {
      siteId,
      applicationId: claims.sub,
      organizationId: claims.org_id ?? organizationId ?? '',
      clientId: claims.client_id,
    };
  }
}
