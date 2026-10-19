'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { setAuthTokens } from '@/lib/auth';

const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3002';

function CallbackContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  // Guard against React StrictMode double-invocation:
  // First run clears sessionStorage, second run would find nothing → false error flash.
  const exchangingRef = useRef(false);

  useEffect(() => {
    if (exchangingRef.current) return;
    exchangingRef.current = true;

    async function exchangeCode() {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const appIdFromUrl = searchParams.get('app_id');

      if (!code || !state) {
        setError('Missing authorization code or state');
        return;
      }

      // Verify state matches what we stored
      const storedState = sessionStorage.getItem('oauth_state');
      if (state !== storedState) {
        setError('State mismatch — possible CSRF attack');
        return;
      }

      // Get PKCE verifier
      const codeVerifier = sessionStorage.getItem('pkce_verifier');
      if (!codeVerifier) {
        setError('Missing PKCE verifier');
        return;
      }

      // Get appId from URL or sessionStorage
      const appId = appIdFromUrl || sessionStorage.getItem('app_id');

      try {
        const callbackUrl = `${window.location.origin}/auth/callback`;

        // Exchange code for tokens
        const res = await fetch(`${ADMIN_API_URL}/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code,
            redirect_uri: callbackUrl,
            code_verifier: codeVerifier,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.message || `Token exchange failed (${res.status})`);
          return;
        }

        const data = await res.json();

        // Store auth data via centralized auth module
        setAuthTokens(data.access_token, data.refresh_token, data.user);

        // Clean up sessionStorage only AFTER successful exchange
        sessionStorage.removeItem('oauth_state');
        sessionStorage.removeItem('pkce_verifier');
        sessionStorage.removeItem('app_id');

        // Redirect to workflows — validate appId is a UUID to prevent redirect manipulation
        const targetAppId = data.app_id || appId;
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (targetAppId && uuidPattern.test(targetAppId)) {
          window.location.href = `/workflows?appId=${targetAppId}`;
        } else {
          window.location.href = '/workflows';
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to exchange authorization code';
        setError(message);
      }
    }

    exchangeCode();
  }, [searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold mb-2">Authentication Failed</h2>
          <p className="text-red-600 text-sm">{error}</p>
          <a href="/auth/signin" className="text-blue-600 hover:underline text-sm mt-4 inline-block">
            Try signing in again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Completing authentication...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
