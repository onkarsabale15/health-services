'use client';

import { useEffect, useRef } from 'react';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '@/lib/pkce';
import { isAuthenticated } from '@/lib/auth';

const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3002';

export default function SigninPage() {
  const initiatedRef = useRef(false);

  useEffect(() => {
    if (initiatedRef.current) return;
    initiatedRef.current = true;

    // If already authenticated, go to workflows
    if (isAuthenticated()) {
      window.location.href = '/workflows';
      return;
    }

    async function startOAuthFlow() {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateState();

      sessionStorage.setItem('pkce_verifier', codeVerifier);
      sessionStorage.setItem('oauth_state', state);

      const callbackUrl = `${window.location.origin}/auth/callback`;

      const authorizeUrl = new URL(`${ADMIN_API_URL}/oauth/authorize`);
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('redirect_uri', callbackUrl);
      authorizeUrl.searchParams.set('state', state);
      authorizeUrl.searchParams.set('code_challenge', codeChallenge);
      authorizeUrl.searchParams.set('code_challenge_method', 'S256');

      // No session_token — authorize endpoint will redirect to admin-ui signin
      window.location.href = authorizeUrl.toString();
    }

    startOAuthFlow();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Redirecting to sign in...</p>
      </div>
    </div>
  );
}
