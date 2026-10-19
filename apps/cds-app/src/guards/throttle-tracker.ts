/**
 * Identity-based tracker for CDS rate limiting.
 *
 * Priority:
 *   1. Session cookie → per-provider-session
 *   2. Email in body (OTP endpoints) → per-email
 *   3. IP fallback
 */
export function cdsIdentityTracker(req: Record<string, any>): string {
  const sessionId = req.cookies?.cds_provider_session;
  if (sessionId) return `session:${sessionId}`;

  if (req.body?.email) return `email:${req.body.email}`;

  return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}
