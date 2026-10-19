'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/button';

const API_BASE = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3002';

interface ConsentContext {
  app: { name: string; appType: string; organizationName?: string };
  user: { email: string };
  scopes: string[];
  redirectUri: string;
}

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: 'Identify you across applications',
  profile: 'Your name and basic profile fields',
  email: 'Your email address',
  offline_access: 'Stay signed in without re-entering credentials',
};

function describeScope(scope: string) {
  return SCOPE_DESCRIPTIONS[scope] ?? scope;
}

export default function ConsentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 flex items-center justify-center">
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      }
    >
      <ConsentInner />
    </Suspense>
  );
}

function ConsentInner() {
  const params = useSearchParams();
  const ticket = params?.get('ticket') ?? '';
  const [ctx, setCtx] = useState<ConsentContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<'approve' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticket) {
      setError('Missing consent ticket. Return to the application and try again.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/oauth/consent/context?ticket=${encodeURIComponent(ticket)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Failed to load consent context (${res.status})`);
        }
        const json = (await res.json()) as ConsentContext;
        if (!cancelled) setCtx(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load consent context');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticket]);

  async function decide(decision: 'approve' | 'deny') {
    setSubmitting(decision);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/oauth/consent/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket, decision }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `Consent decision failed (${res.status})`);
      }
      const { redirect } = (await res.json()) as { redirect: string };
      window.location.assign(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Consent decision failed');
      setSubmitting(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 space-y-6">
        <div className="text-center space-y-1">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Authorization</p>
          <h1 className="text-2xl font-bold text-gray-900">Connect a partner app</h1>
        </div>

        {loading ? (
          <p className="text-center text-sm text-gray-500 py-8">Loading…</p>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
        ) : ctx ? (
          <>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-gray-500">Application</p>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                  {ctx.app.appType}
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900">{ctx.app.name}</p>
              {ctx.app.organizationName && <p className="text-xs text-gray-500">Owned by {ctx.app.organizationName}</p>}
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-gray-500">Signed in as</p>
              <p className="text-sm font-medium text-gray-800">{ctx.user.email}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-gray-500">This app will be able to</p>
              <ul className="space-y-1.5">
                {ctx.scopes.length === 0 ? (
                  <li className="text-sm text-gray-500">— no scopes requested —</li>
                ) : (
                  ctx.scopes.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-1">{s}</code>
                        {describeScope(s)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              You can revoke this access at any time from your connected apps settings. By approving, you allow{' '}
              <span className="font-bold">{ctx.app.name}</span> to use the listed information.
            </p>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="md"
                onClick={() => decide('deny')}
                disabled={submitting !== null}
                loading={submitting === 'deny'}
                loadingText="Cancelling..."
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => decide('approve')}
                disabled={submitting !== null}
                loading={submitting === 'approve'}
                loadingText="Approving..."
                className="flex-1"
              >
                Approve
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
