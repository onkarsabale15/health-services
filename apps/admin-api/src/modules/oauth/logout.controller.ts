import { BadRequestException, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { cache } from '@hs/infra';
import { logger } from '@hs/observability';
import type { Request, Response } from 'express';
import { Public } from '../../decorators/auth.decorator';
import { AdminCacheKeys } from '../../cache/cache-keys';
import { verifyToken } from '../auth/jwt.service';
import { validateRedirectUri } from '../../utils/redirect-uri.util';

// ─── /oauth/logout (RP-Initiated Logout — OIDC RP-Initiated Logout 1.0) ────
//
// Accepts an `id_token_hint` (the previously issued id_token), blacklists
// its `jti`, then optionally redirects to `post_logout_redirect_uri`. Spec
// permits both GET and POST; we support both.
//
// Best-effort scope (per Phase B plan):
//   - jti blacklist: works (existing oauth:revoked:{jti} pattern reused).
//   - refresh-token revocation: NOT done in V1 — there's no sub→refresh
//     index in Redis. Refresh tokens expire naturally (7d) or are rotated
//     out on the user's next signin. Strict revocation is a follow-up
//     when we add `session:user-refresh:{sub}` (also unlocks
//     "force-logout-everywhere" admin actions).

@ApiTags('OAuth 2.0')
@Controller('oauth')
@Public()
export class LogoutController {
  @Get('logout')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiSecurity({})
  @ApiOperation({ summary: 'OIDC RP-Initiated Logout (GET)' })
  @ApiQuery({ name: 'id_token_hint', required: true })
  @ApiQuery({ name: 'post_logout_redirect_uri', required: false })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({
    name: 'client_id',
    required: false,
    description: 'Optional override; otherwise derived from id_token aud',
  })
  @ApiResponse({ status: 302, description: 'Redirects to post_logout_redirect_uri' })
  @ApiResponse({ status: 200, description: 'Sign-out confirmation when no redirect requested' })
  @ApiResponse({ status: 400, description: 'Missing id_token_hint or invalid redirect URI' })
  async logoutGet(
    @Query('id_token_hint') idTokenHint: string | undefined,
    @Query('post_logout_redirect_uri') postLogoutRedirectUri: string | undefined,
    @Query('state') state: string | undefined,
    @Query('client_id') clientId: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleLogout({ idTokenHint, postLogoutRedirectUri, state, clientId, req, res });
  }

  @Post('logout')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiSecurity({})
  @ApiOperation({ summary: 'OIDC RP-Initiated Logout (POST)' })
  async logoutPost(
    @Query('id_token_hint') idTokenHint: string | undefined,
    @Query('post_logout_redirect_uri') postLogoutRedirectUri: string | undefined,
    @Query('state') state: string | undefined,
    @Query('client_id') clientId: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleLogout({ idTokenHint, postLogoutRedirectUri, state, clientId, req, res });
  }

  private async handleLogout(opts: {
    idTokenHint: string | undefined;
    postLogoutRedirectUri: string | undefined;
    state: string | undefined;
    clientId: string | undefined;
    req: Request;
    res: Response;
  }) {
    const { idTokenHint, postLogoutRedirectUri, state, clientId, req, res } = opts;

    if (!idTokenHint) {
      throw new BadRequestException('id_token_hint is required');
    }

    // Verify the id_token. Audience NOT enforced — id_tokens are scoped to
    // RP client_id, not our admin/api/cds audiences, so verifyToken's
    // optional audience param is intentionally omitted here.
    let payload: Record<string, unknown>;
    try {
      payload = (await verifyToken(idTokenHint)) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid id_token_hint');
    }

    const jti = typeof payload.jti === 'string' ? payload.jti : undefined;
    const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
    const sub = typeof payload.sub === 'string' ? payload.sub : undefined;
    const aud = typeof payload.aud === 'string' ? payload.aud : undefined;

    // Blacklist the jti for the remaining lifetime so /oauth/introspect
    // returns active=false and the same id_token can't be re-used.
    if (jti && exp) {
      const ttl = Math.max(0, exp - Math.floor(Date.now() / 1000));
      if (ttl > 0) {
        await cache.set(AdminCacheKeys.oauthRevoked(jti), '1', ttl).catch(() => {});
      }
    }

    logger.info('OIDC logout', { sub, aud, clientId: clientId || aud, hasRedirect: !!postLogoutRedirectUri });

    // Validate post_logout_redirect_uri against the RP's registered URIs
    // (or first-party allow-list). Reuses the same util the authorize
    // flow uses — same allow-list semantics.
    if (postLogoutRedirectUri) {
      const effectiveClientId = clientId || aud;
      await validateRedirectUri(postLogoutRedirectUri, effectiveClientId);
      const target = new URL(postLogoutRedirectUri);
      if (state) target.searchParams.set('state', state);
      return res.redirect(target.toString());
    }

    // No redirect requested — content-negotiate. JSON for API callers,
    // tiny HTML page for browsers.
    const accept = (req.headers.accept || '').toString();
    if (accept.includes('application/json')) {
      return res.status(200).json({ message: 'Signed out' });
    }
    return res
      .status(200)
      .type('html')
      .send('<!doctype html><meta charset="utf-8"><title>Signed out</title><body><p>You have been signed out.</p>');
  }
}
