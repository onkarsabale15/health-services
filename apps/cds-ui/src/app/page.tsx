'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Root page should only be hit directly — redirect to indicate missing session
    router.replace('/app');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-secondary">Redirecting...</p>
    </div>
  );
}
