'use client';

import { useEffect } from 'react';

/**
 * Legacy SSO page — redirects to the new OAuth PKCE sso-launch flow.
 * Kept for backward compatibility with admin-ui links that may still
 * point to /auth/sso#token=...&appId=...
 */
export default function LegacySsoPage() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      // Forward hash params to new sso-launch page
      window.location.href = `/auth/sso-launch${hash}`;
    } else {
      window.location.href = '/auth/signin';
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Redirecting...</p>
      </div>
    </div>
  );
}
