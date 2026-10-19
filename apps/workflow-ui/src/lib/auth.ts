import type { AuthUser } from '@/types';

const TOKEN_KEY = 'wf_token';
const REFRESH_TOKEN_KEY = 'wf_refresh_token';
const USER_KEY = 'wf_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    clearAuth();
    return null;
  }
}

/**
 * Parse JWT payload without verification (client-side only).
 * The server (admin-api) does the real RS384 verification.
 */
function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;

  // Check if token is expired (client-side check)
  const payload = parseJwtPayload(token);
  if (!payload?.exp) return false;
  return (payload.exp as number) * 1000 > Date.now();
}

/**
 * Store tokens received from OAuth token exchange.
 */
export function setAuthTokens(accessToken: string, refreshToken?: string, user?: AuthUser) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}
