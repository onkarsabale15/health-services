'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check for SSO token in URL hash (from admin-ui launch)
    const hash = window.location.hash;
    if (hash.includes('token=')) {
      router.replace(`/auth/sso${hash}`);
      return;
    }

    if (isAuthenticated()) {
      router.replace('/workflows');
    } else {
      // Not authenticated — redirect to admin-ui for SSO
      const adminUrl = process.env.NEXT_PUBLIC_ADMIN_UI_URL || 'http://localhost:3001';
      window.location.href = `${adminUrl}/auth/signin`;
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
