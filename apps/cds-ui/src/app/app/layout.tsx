'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cdsApi } from '@/lib/api';
import { SessionProvider, useSession } from '@/hooks/useSession';
import { AnalysisStatusProvider } from '@/hooks/useAnalysisStatus';
import { AnalysisStatusBanner } from '@/components/AnalysisStatusBanner';

/**
 * Top-level CDS shell. Holds only cross-cutting providers + session effects —
 * NO visual chrome. Each screen (launch, patient search, encounter view) is
 * full-bleed and owns its own header/sidebar/top-bar per the redesign.
 *
 * Session state lives in `SessionProvider` so any descendant can read it via
 * `useSession()`. The practitioner fetch below triggers the BE's lazy role
 * hydration (derives `providerRole` from FHIR Practitioner.qualification), then
 * refreshes the session so children see the upgraded capabilities immediately.
 */
export default function CdsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AnalysisStatusProvider>
        <CdsSessionEffects />
        {children}
        <AnalysisStatusBanner />
      </AnalysisStatusProvider>
    </SessionProvider>
  );
}

/** Effects-only — runs auth redirect + practitioner/role hydration, renders nothing. */
function CdsSessionEffects() {
  const router = useRouter();
  const { error: sessionError, refresh: refreshSession } = useSession();

  // Bounce to login on 401 / unauthorized.
  useEffect(() => {
    if (sessionError && (sessionError.includes('401') || sessionError.toLowerCase().includes('unauthor'))) {
      router.replace('/auth/login');
    }
  }, [sessionError, router]);

  // Fetch the FHIR Practitioner — the BE derives + persists the provider role
  // from it; refresh the session so capability gating updates immediately.
  useEffect(() => {
    cdsApi
      .getPractitioner()
      .then(() => refreshSession())
      .catch(() => {
        /* practitioner is optional — system mode may not have one */
      });
  }, [refreshSession]);

  return null;
}
