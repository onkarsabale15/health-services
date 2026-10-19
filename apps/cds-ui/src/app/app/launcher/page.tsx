'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { cdsApi } from '@/lib/api';
import { EhrLauncherCard } from '@/components/EhrLauncherCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBanner from '@/components/ErrorBanner';
import { staggerContainer, fadeInUp } from '@/lib/motion';

type EhrEntry = Awaited<ReturnType<typeof cdsApi.getLauncherIntegrations>>['ehrs'][number];

export default function LauncherPage() {
  const router = useRouter();
  const [ehrs, setEhrs] = useState<EhrEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    cdsApi
      .getLauncherIntegrations()
      .then((data) => setEhrs(data.ehrs))
      .catch((err) => setError(err?.message || 'Failed to load integrations'))
      .finally(() => setLoading(false));
  }, []);

  const handleModeClick = (ehrName: string, appType: string) => {
    if (appType === 'system') {
      // System mode is already active (session cookie) → go to patient search
      router.push('/app/patient-search');
    } else if (appType === 'provider-standalone') {
      // Redirect to standalone launch entry → initiates SMART auth flow
      window.location.href = `/launch/standalone/${ehrName}`;
    }
  };

  const greeting = getGreeting();

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Page header */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="mb-10">
        <h1 className="text-3xl font-bold text-surface-on tracking-tight">{greeting}</h1>
        <p className="text-base text-surface-on-variant mt-1">
          Select an EHR integration to begin your clinical session
        </p>
      </motion.div>

      {error && <ErrorBanner message={error} />}

      {/* EHR cards grid */}
      {ehrs.length === 0 && !loading && !error ? (
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="text-center py-20">
          <span className="material-symbols-outlined text-secondary/30 mb-4 inline-block" style={{ fontSize: 64 }}>
            local_hospital
          </span>
          <h2 className="text-xl font-semibold text-surface-on mb-2">No EHRs configured</h2>
          <p className="text-sm text-secondary max-w-md mx-auto">
            Contact your administrator to configure EHR integrations for this application.
          </p>
        </motion.div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {ehrs.map((ehr) => (
            <EhrLauncherCard
              key={ehr.ehrName}
              ehrName={ehr.ehrName}
              label={ehr.label}
              modes={ehr.modes}
              capabilities={ehr.capabilities}
              carePlan={ehr.carePlan}
              onModeClick={handleModeClick}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
