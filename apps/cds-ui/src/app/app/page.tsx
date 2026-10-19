'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cdsApi } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

/**
 * Root /app route — mode-aware router:
 * - Session with patient → /app/patient/{id} (encounter view)
 * - Session without patient (standalone/system) → /app/patient-search
 * - No session → the launch screen (/auth/login)
 */
export default function AppRootPage() {
  const router = useRouter();

  useEffect(() => {
    cdsApi
      .getSessionInfo()
      .then((session) => {
        if (session.currentPatient?.patientId) {
          router.replace(`/app/patient/${session.currentPatient.patientId}`);
        } else {
          router.replace('/app/patient-search');
        }
      })
      .catch(() => router.replace('/auth/login'));
  }, [router]);

  return <LoadingSpinner />;
}
