'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { onSessionExpired } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

const ADMIN_UI_URL = process.env.NEXT_PUBLIC_ADMIN_UI_URL || 'http://localhost:3001';

/**
 * Modal overlay shown when session expires and refresh token fails.
 * Embeds admin-ui signin in an iframe so the user can re-login
 * without losing their workflow editor state.
 *
 * After the user signs in via admin-ui, admin-ui redirects back to
 * workflow-ui's /auth/sso-launch which completes the OAuth flow
 * and stores new tokens. We detect the new token via polling.
 */
export function SessionExpiredModal() {
  const [visible, setVisible] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSessionExpired = useCallback(() => {
    setVisible(true);
  }, []);

  // Subscribe to session-expired events from ApiClient
  useEffect(() => {
    return onSessionExpired(handleSessionExpired);
  }, [handleSessionExpired]);

  // Poll localStorage for new token (set by /auth/callback after re-login)
  useEffect(() => {
    if (!visible) return;

    pollRef.current = setInterval(() => {
      if (isAuthenticated()) {
        setVisible(false);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [visible]);

  function handleManualSignin() {
    // Fallback: redirect to full signin flow (loses editor state)
    window.location.href = '/auth/signin';
  }

  if (!visible) return null;

  // Build the admin-ui signin URL that will redirect back to workflow-ui SSO
  const ssoReturnUrl = `${window.location.origin}/auth/sso-launch`;
  const signinUrl = `${ADMIN_UI_URL}/auth/signin?return_url=${encodeURIComponent(ssoReturnUrl)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Session Expired</h2>
          <p className="text-sm text-gray-500 mt-1">Sign in again to continue. Your work is preserved.</p>
        </div>

        {/* Iframe */}
        <div className="h-[400px]">
          <iframe
            src={signinUrl}
            className="w-full h-full border-0"
            title="Sign in"
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-gray-50 flex justify-between items-center">
          <span className="text-xs text-gray-400">Having trouble?</span>
          <button onClick={handleManualSignin} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Open full sign-in page
          </button>
        </div>
      </div>
    </div>
  );
}
