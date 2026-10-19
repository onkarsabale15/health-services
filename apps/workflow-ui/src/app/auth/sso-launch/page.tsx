'use client';

import { useEffect, useRef } from 'react';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '@/lib/pkce';

const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3002';

export default function SsoLaunchPage() {
  const initiatedRef = useRef(false);

  useEffect(() => {
    if (initiatedRef.current) return;
    initiatedRef.current = true;

    async function initOAuthFlow() {
      const callbackUrl = `${window.location.origin}/auth/callback`;

      // Read SSO code and appId from URL hash (opaque code, not a JWT)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const ssoCode = params.get('sso_code');
      const appId = params.get('appId');

      if (!ssoCode) {
        // No SSO code — redirect to signin flow
        window.location.href = '/auth/signin';
        return;
      }

      // Generate PKCE pair
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateState();

      // Store in sessionStorage for callback page
      sessionStorage.setItem('pkce_verifier', codeVerifier);
      sessionStorage.setItem('oauth_state', state);
      if (appId) sessionStorage.setItem('app_id', appId);

      // Clear the hash immediately (don't leave code in URL bar)
      history.replaceState(null, '', '/auth/sso-launch');

      // Redirect to authorize endpoint with SSO code (not session token)
      const authorizeUrl = new URL(`${ADMIN_API_URL}/oauth/authorize`);
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('redirect_uri', callbackUrl);
      authorizeUrl.searchParams.set('state', state);
      authorizeUrl.searchParams.set('code_challenge', codeChallenge);
      authorizeUrl.searchParams.set('code_challenge_method', 'S256');
      authorizeUrl.searchParams.set('sso_code', ssoCode);
      if (appId) authorizeUrl.searchParams.set('app_id', appId);

      window.location.href = authorizeUrl.toString();
    }

    initOAuthFlow();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Authenticating...</p>
      </div>
    </div>
  );
}
