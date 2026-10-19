/**
 * Identity-based tracker for rate limiting.
 *
 * Extracts the most specific identity from the request to use as the
 * throttle bucket key. Works independently of auth guards by decoding
 * (not verifying) JWTs — verification happens in DualAuthGuard.
 *
 * Priority:
 *   1. clientId from request.user (set by DualAuthGuard if it ran first)
 *   2. clientId decoded from OAuth Bearer JWT
 *   3. userId from API key auth (request.user.userId)
 *   4. IP address (fallback for @Public endpoints like SMART launch)
 */
export function identityTracker(req: Record<string, any>): string {
  // 1. Already-authenticated request (DualAuthGuard ran first)
  if (req.user?.clientId) {
    return `client:${req.user.clientId}`;
  }
  if (req.user?.userId) {
    return `apikey:${req.user.userId}`;
  }

  // 2. Decode Bearer JWT to extract clientId (guard-order independent)
  const auth = req.headers?.authorization as string | undefined;
  if (auth?.startsWith('Bearer ')) {
    try {
      const parts = auth.slice(7).split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (payload.client_id) {
          return `client:${payload.client_id}`;
        }
        if (payload.sub) {
          return `sub:${payload.sub}`;
        }
      }
    } catch {
      // Malformed token — fall through
    }
  }

  // 3. Fallback to IP (public endpoints like health, SMART launch)
  return `ip:${req.ip}`;
}
