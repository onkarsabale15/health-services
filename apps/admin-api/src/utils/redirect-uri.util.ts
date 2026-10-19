import { BadRequestException } from '@nestjs/common';
import { db } from '@hs/infra';

// ─── Redirect-URI validation (RFC 6749 §3.1.2.2) ──────────────────────────
//
// Lifted out of OAuthController so other endpoints (logout, future consent
// flow) can reuse the same allowlist semantics without instantiating the
// controller. Behavior preserved verbatim — see `oauth.controller.ts` git
// history before this extraction for the original.

export async function validateRedirectUri(redirectUri: string, clientId?: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new BadRequestException('Invalid redirect_uri');
  }

  const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

  if (!isLocalhost && parsed.protocol !== 'https:') {
    throw new BadRequestException('redirect_uri must use HTTPS');
  }

  if (isLocalhost) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('localhost redirect URIs are not allowed in production');
    }
    return;
  }

  // Check app-registered redirect URIs first (for third-party SMART apps).
  if (clientId) {
    const prisma = db.getClient();
    const app = await prisma.application.findUnique({
      where: { clientId },
      select: { redirectUris: true },
    });
    if (app?.redirectUris?.length) {
      const registered = app.redirectUris.some((uri) => {
        try {
          return new URL(uri).origin === parsed.origin;
        } catch {
          return false;
        }
      });
      if (registered) return;
    }
  }

  // Fall back to first-party config check (ADMIN_UI_URL, WORKFLOW_UI_URL).
  const allowedOrigins: string[] = [];

  const adminUiUrl = process.env.ADMIN_UI_URL;
  const workflowUiUrl = process.env.WORKFLOW_UI_URL;

  if (adminUiUrl) {
    try {
      allowedOrigins.push(new URL(adminUiUrl).origin);
    } catch {
      /* skip invalid */
    }
  }
  if (workflowUiUrl) {
    try {
      allowedOrigins.push(new URL(workflowUiUrl).origin);
    } catch {
      /* skip invalid */
    }
  }

  // Fail closed: with no UI URLs configured we'd otherwise silently accept
  // any HTTPS origin. Localhost is already allowed earlier (gated by
  // NODE_ENV) so dev setups are unaffected.
  if (allowedOrigins.length === 0) {
    throw new BadRequestException('No redirect URIs configured');
  }
  if (!allowedOrigins.includes(parsed.origin)) {
    throw new BadRequestException('redirect_uri origin is not registered');
  }
}
