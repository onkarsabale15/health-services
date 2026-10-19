'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/button';

const API_BASE = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3002';
const TOKEN_STORAGE_KEY = 'endUserAccessToken';

interface Connection {
  clientId: string;
  applicationName: string;
  scopes: string[];
  grantedAt: string;
  lastUsedAt: string | null;
}

/**
 * End-user "Connected Apps" page. Distinct from `/dashboard/*` which is
 * operator-only. Auth flow: a partner app hands its end-user access token
 * (aud=client_id, role=end-user) to this page via sessionStorage when it
 * deep-links here. Operator session tokens are intentionally rejected by
 * the backend's EndUserSessionGuard — they cannot manage end-user state.
 *
 * Surfacing real OTP-based end-user signin is a follow-up; today this page
 * works for partner apps that already have a token to hand off.
 */
export default function ConnectionsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingClientId, setRevokingClientId] = useState<string | null>(null);

  // Read token once on mount; partner apps stash it in sessionStorage before navigating here.
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.sessionStorage.getItem(TOKEN_STORAGE_KEY) : null;
    setToken(stored);
    if (!stored) setLoading(false);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/users/me/connections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        throw new Error('Your session has expired. Re-open this page from the partner app.');
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message || `Failed to load connections (${res.status})`);
      }
      const json = (await res.json()) as Connection[];
      setConnections(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  async function revoke(conn: Connection) {
    if (!token) return;
    setRevokingClientId(conn.clientId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/users/me/connections/${encodeURIComponent(conn.clientId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message || `Failed to revoke (${res.status})`);
      }
      setConnections((prev) => prev.filter((c) => c.clientId !== conn.clientId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke');
    } finally {
      setRevokingClientId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 flex items-start justify-center p-4 py-12">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Account</p>
          <h1 className="text-2xl font-bold text-gray-900">Connected Apps</h1>
          <p className="text-sm text-gray-500">
            Apps you've authorized to access your account. Disconnect at any time.
          </p>
        </div>

        {!token ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800 space-y-2">
            <p className="font-bold">Sign-in required</p>
            <p>This page is opened from a connected app. Return to that app and use its "Manage connections" link.</p>
          </div>
        ) : loading ? (
          <p className="text-center text-sm text-gray-500 py-8">Loading…</p>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
        ) : connections.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">You haven't connected any apps yet.</div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {connections.map((c) => (
              <li key={c.clientId} className="py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-bold text-gray-900">{c.applicationName}</p>
                  <p className="text-xs text-gray-500">
                    Connected {new Date(c.grantedAt).toLocaleDateString()}
                    {c.lastUsedAt ? ` · last used ${new Date(c.lastUsedAt).toLocaleDateString()}` : ' · never used'}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {c.scopes.map((s) => (
                      <code key={s} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {s}
                      </code>
                    ))}
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  loading={revokingClientId === c.clientId}
                  loadingText="Revoking..."
                  confirmMessage={`Disconnect ${c.applicationName}? It will lose access immediately.`}
                  onClick={() => revoke(c)}
                  disabled={revokingClientId !== null}
                >
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
