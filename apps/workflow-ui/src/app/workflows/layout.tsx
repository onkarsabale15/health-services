'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getToken, getRefreshToken, getUser, clearAuth, isAuthenticated } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/toast';
import { SessionExpiredModal } from '@/components/ui/session-expired-modal';
import type { AuthUser } from '@/types';

const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3002';

const NAV_ITEMS = [{ href: '/workflows', label: 'Workflows' }];

export default function WorkflowsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.href = '/auth/signin';
      return;
    }
    setUser(getUser());
  }, [router]);

  function handleBackToAdmin() {
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_UI_URL || 'http://localhost:3001';
    window.location.href = `${adminUrl}/dashboard/applications`;
  }

  async function handleSignOut() {
    // Revoke tokens server-side before clearing local state
    const token = getToken();
    const refreshToken = getRefreshToken();
    const revocations: Promise<unknown>[] = [];
    if (token) {
      revocations.push(
        fetch(`${ADMIN_API_URL}/oauth/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        }).catch(() => {}),
      );
    }
    if (refreshToken) {
      revocations.push(
        fetch(`${ADMIN_API_URL}/oauth/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: refreshToken }),
        }).catch(() => {}),
      );
    }
    // Best-effort revocation — don't block sign-out on failures
    await Promise.all(revocations).catch(() => {});
    clearAuth();
    window.location.href = '/auth/signin';
  }

  if (!user) return null;

  return (
    <ToastProvider>
      <SessionExpiredModal />
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-14">
              <div className="flex items-center space-x-8">
                <span className="font-bold text-gray-900">IB Workflows</span>
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm font-medium py-4 border-b-2 ${
                      pathname === item.href || (item.href !== '/workflows' && pathname.startsWith(item.href))
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="flex items-center space-x-4">
                <button onClick={handleBackToAdmin} className="text-sm text-gray-500 hover:text-blue-600">
                  Admin Dashboard
                </button>
                <span className="text-sm text-gray-500">{user.email}</span>
                <button onClick={handleSignOut} className="text-sm text-red-600 hover:text-red-700">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </div>
    </ToastProvider>
  );
}
