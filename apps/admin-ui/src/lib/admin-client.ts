import { client } from './sdk/generated/client.gen';
import { getRefreshToken, clearAuth } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3002';

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
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
    localStorage.setItem('token', data.access_token);
    if (data.refresh_token) localStorage.setItem('refreshToken', data.refresh_token);
    if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
    return true;
  } catch {
    return false;
  }
}

/**
 * Configure the auto-generated hey-api client with auth + base URL.
 * Must be called once at app startup (layout or _app).
 */
export function configureAdminClient() {
  client.setConfig({ baseUrl: BASE_URL });

  // Add auth interceptor — injects Bearer token into every request
  client.interceptors.request.use((request) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  });

  // Add response interceptor — handle 401 with token refresh
  client.interceptors.response.use(async (response) => {
    if (response.status === 401 && typeof window !== 'undefined') {
      if (!refreshing) {
        refreshing = tryRefresh().finally(() => {
          refreshing = null;
        });
      }
      const refreshed = await refreshing;

      if (refreshed) {
        // Retry the original request with new token
        const token = localStorage.getItem('token');
        const retryRequest = (response as any).request.clone();
        if (token) {
          retryRequest.headers.set('Authorization', `Bearer ${token}`);
        }
        return fetch(retryRequest);
      }

      clearAuth();
      window.location.href = '/auth/signin';
    }
    return response;
  });
}
