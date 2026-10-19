/**
 * Identity-based tracker for rate limiting.
 *
 * Extracts the most specific identity available from the request
 * to use as the throttle bucket key. This runs BEFORE auth guards,
 * so we decode (but don't verify) JWTs — verification still happens
 * in SessionGuard / DualAuthGuard.
 *
 * Priority:
 *   1. userId from session JWT (admin portal users)
 *   2. clientId from OAuth JWT (machine-to-machine apps)
 *   3. clientId from Basic auth header (OAuth token endpoint)
 *   4. clientId from request body (OAuth token endpoint alternative)
 *   5. email from request body (signin/signup)
 *   6. IP address (fallback for anonymous/public endpoints)
 */
export function identityTracker(req: Record<string, any>): string {
  const auth = req.headers?.authorization as string | undefined;

  // 1–2. Decode Bearer JWT (session or OAuth access token)
  if (auth?.startsWith('Bearer ')) {
    try {
      const parts = auth.slice(7).split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

        // Session token → rate limit per admin user
        if (payload.sub && payload.token_type === 'session') {
          return `user:${payload.sub}`;
        }

        // OAuth access token → rate limit per application
        if (payload.client_id) {
          return `client:${payload.client_id}`;
        }

        // Any other JWT with sub claim
        if (payload.sub) {
          return `sub:${payload.sub}`;
        }
      }
    } catch {
      // Malformed token — fall through to other strategies
    }
  }

  // 3. Basic auth → extract clientId (before the colon)
  if (auth?.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf-8');
      const colonIdx = decoded.indexOf(':');
      if (colonIdx > 0) {
        return `client:${decoded.substring(0, colonIdx)}`;
      }
    } catch {
      // Malformed Basic header — fall through
    }
  }

  // 4. clientId from request body (OAuth token endpoint alternative)
  if (req.body?.client_id) {
    return `client:${req.body.client_id}`;
  }

  // 5. Email from request body (signin/signup — prevents per-account brute-force)
  if (req.body?.email) {
    return `email:${req.body.email}`;
  }

  // 6. Fallback to IP
  return `ip:${req.ip}`;
}
