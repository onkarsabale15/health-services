import { getToken, getRefreshToken, setAuthTokens, clearAuth } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3002';
const API_URL = `${BASE_URL}/api`;

// Session-expired listeners — UI components subscribe to show re-login modal
type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function notifySessionExpired() {
  sessionExpiredListeners.forEach((fn) => fn());
}

class ApiClient {
  private refreshing: Promise<boolean> | null = null;

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return getToken();
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const token = this.getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  private async tryRefresh(): Promise<boolean> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      setAuthTokens(data.access_token, data.refresh_token, data.user);
      return true;
    } catch {
      return false;
    }
  }

  async request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...this.getHeaders(), ...(options.headers || {}) },
    });

    if (res.status === 401 && typeof window !== 'undefined') {
      // Deduplicate concurrent refresh attempts
      if (!this.refreshing) {
        this.refreshing = this.tryRefresh().finally(() => {
          this.refreshing = null;
        });
      }
      const refreshed = await this.refreshing;

      if (refreshed) {
        // Retry the original request with new token
        const retry = await fetch(`${API_URL}${path}`, {
          ...options,
          headers: { ...this.getHeaders(), ...(options.headers || {}) },
        });
        const retryData = await retry.json();
        if (!retry.ok) {
          if (retry.status === 401) {
            clearAuth();
            notifySessionExpired();
          }
          const error: Error & { status?: number } = new Error(
            retryData.message || retryData.error || 'Request failed',
          );
          error.status = retry.status;
          throw error;
        }
        return retryData as T;
      }

      // Refresh failed — notify UI to show re-login modal
      clearAuth();
      notifySessionExpired();
      throw new Error('Session expired');
    }

    const data = await res.json();
    if (!res.ok) {
      const error: Error & { status?: number } = new Error(data.message || data.error || 'Request failed');
      error.status = res.status;
      throw error;
    }
    return data as T;
  }

  get<T = unknown>(path: string) {
    return this.request<T>(path);
  }

  post<T = unknown>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  }

  patch<T = unknown>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  }

  put<T = unknown>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
  }

  delete<T = unknown>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
