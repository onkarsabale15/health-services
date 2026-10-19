'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { configureAdminClient } from '@/lib/admin-client';
import { authControllerSignIn, authControllerCreateSsoCode } from '@/lib/sdk/generated';
import { setAuth } from '@/lib/auth';
import { Button } from '@/components/button';
import { PasswordToggle } from '@/components/password-toggle';

configureAdminClient();

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: signInError } = await authControllerSignIn({ body: { email, password } });
      if (signInError || !data) throw new Error((signInError as any)?.message || 'Sign in failed');
      setAuth(data as any);

      // If return_url is present (OAuth authorize flow), create SSO code and redirect
      const returnUrl = searchParams.get('return_url');
      if (returnUrl) {
        try {
          const url = new URL(returnUrl);
          const adminApiUrl = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3002';
          const allowedOrigin = new URL(adminApiUrl).origin;
          if (url.origin !== allowedOrigin) {
            throw new Error('Untrusted return URL');
          }
          const { data: ssoData } = await authControllerCreateSsoCode();
          if (ssoData) {
            url.searchParams.set('sso_code', (ssoData as any).sso_code);
            window.location.href = url.toString();
            return;
          }
        } catch {
          /* ignore */
        }
      }

      router.push('/dashboard/applications');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="aegis-card w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-surface-on mb-1 text-center">Sign In</h2>
        <p className="text-sm text-surface-on-variant text-center mb-6">
          Enter your credentials to manage integrations
        </p>

        {error && (
          <div className="bg-error-container text-error-dim p-3 rounded-round-four text-xs mb-6 flex items-center gap-2">
            <span>&#10007;</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5 ml-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="aegis-input"
              placeholder="name@organization.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5 ml-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="aegis-input pr-10"
                placeholder="••••••••"
              />
              <PasswordToggle visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />
            </div>
          </div>

          <Button type="submit" variant="primary" className="w-full" loading={loading} loadingText="Authenticating...">
            Sign In
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-surface-on-variant">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-primary font-semibold hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">Loading...</div>}>
      <SignInForm />
    </Suspense>
  );
}
