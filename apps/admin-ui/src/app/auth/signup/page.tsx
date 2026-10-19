'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { configureAdminClient } from '@/lib/admin-client';
import { authControllerSignUp } from '@/lib/sdk/generated';
import { setAuth } from '@/lib/auth';
import { Button } from '@/components/button';

configureAdminClient();

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', organizationName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: signUpError } = await authControllerSignUp({ body: form });
      if (signUpError || !data) throw new Error((signUpError as any)?.message || 'Sign up failed');
      if ((data as any).status === 'PENDING') {
        setError('Your account is pending approval by your organization admin.');
        return;
      }
      // When status is ACTIVE, the response includes full auth fields (accessToken, user info)
      // but the SDK type only models the minimal response shape
      setAuth(data as any);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow space-y-4">
      <h2 className="text-xl font-semibold">Create Account</h2>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
          <input
            type="text"
            required
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
          <input
            type="text"
            required
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
        <input
          type="text"
          required
          value={form.organizationName}
          onChange={(e) => update('organizationName', e.target.value)}
          className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <Button type="submit" variant="primary" className="w-full" loading={loading} loadingText="Creating...">
        Create Account
      </Button>

      <p className="text-sm text-center text-gray-500">
        Already have an account?{' '}
        <Link href="/auth/signin" className="text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
