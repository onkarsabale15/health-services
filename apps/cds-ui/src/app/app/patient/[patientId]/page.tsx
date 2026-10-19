'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { cdsApi } from '@/lib/api';
import type { CarePlan } from '@/types';
import { useSession } from '@/hooks/useSession';
import { useAllergies, useConditions, useEncounter, useMedications, usePatient, useVitals } from '@/hooks/useResource';
import { fadeIn } from '@/lib/motion';
import { Skeleton } from '@/components/Skeleton';
import EncounterTopBar from '@/components/encounter/EncounterTopBar';
import SummaryTab from '@/components/encounter/SummaryTab';
import CarePlansTab from '@/components/encounter/CarePlansTab';
import RecommendationsTab from '@/components/encounter/RecommendationsTab';
import FullHistoryTab from '@/components/encounter/FullHistoryTab';
import NotesTab from '@/components/encounter/NotesTab';

/** Draft care plans carry unreviewed recommendations — the top-bar pending count. */
const pendingFromPlan = (p: CarePlan | null) => (p && p.status === 'DRAFT' ? p.cards.length : 0);

const TABS = [
  { id: 'summary', label: 'Summary', icon: 'grid_view' },
  { id: 'careplans', label: 'Care Plans', icon: 'assignment' },
  { id: 'recommendations', label: 'Recommendations', icon: 'neurology' },
  { id: 'history', label: 'Full History', icon: 'history' },
  { id: 'notes', label: 'Encounter Notes', icon: 'description' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Encounter-centric clinical view — the screen a provider works in for a single
 * patient + encounter. Dark top bar (identity, encounter context, vitals, mode)
 * over tab-scoped content. Resources are fetched once here and shared with the
 * top bar + tabs.
 */
export default function EncounterViewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useSession();

  const [tab, setTab] = useState<TabId>('summary');

  const patient = usePatient();
  const conditions = useConditions();
  const allergies = useAllergies();
  const medications = useMedications();
  const vitals = useVitals();
  // Encounter scope: query param (system/standalone selection) or session meta (EHR launch).
  const encounterId = searchParams.get('encounter') ?? patient.meta?.encounterId ?? undefined;
  const encounter = useEncounter(encounterId);

  // Pending recommendations = a draft care plan's unreviewed cards. Fetched
  // once for the badge; the Recommendations tab keeps it live as the plan changes.
  const [pendingRecs, setPendingRecs] = useState(0);
  useEffect(() => {
    let active = true;
    cdsApi
      .getCurrentCarePlan()
      .then((p) => active && setPendingRecs(pendingFromPlan(p)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (patient.loading && !patient.data) return <FirstPaintSkeleton />;
  if (!patient.data) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <div className="text-center">
          <span className="material-symbols-outlined text-secondary/40" style={{ fontSize: 44 }}>
            person_off
          </span>
          <p className="text-secondary text-sm mt-2">No patient in context.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <EncounterTopBar
        patient={patient.data}
        encounter={encounter.data ?? null}
        allergies={allergies.data ?? []}
        vitals={vitals.data ?? []}
        mode={session?.launchMode ?? 'system'}
        pendingRecs={pendingRecs}
        onExit={() => router.push('/auth/login')}
      />

      {/* Tabs */}
      <div className="bg-slate-900 px-6 shrink-0">
        <div className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map((t) => {
            const on = tab === t.id;
            const badge = t.id === 'recommendations' ? pendingRecs : 0;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-[13px] whitespace-nowrap transition-colors rounded-t-md ${
                  on
                    ? 'text-white font-semibold border-b-2 border-primary bg-primary/10'
                    : 'text-slate-500 font-normal border-b-2 border-transparent hover:text-slate-300'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  {t.icon}
                </span>
                {t.label}
                {badge > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto bg-surface">
        <motion.div key={tab} variants={fadeIn} initial="hidden" animate="visible" className="px-7 py-6">
          {tab === 'summary' && (
            <SummaryTab conditions={conditions} allergies={allergies} medications={medications} vitals={vitals} />
          )}
          {tab === 'careplans' && <CarePlansTab />}
          {tab === 'recommendations' && <RecommendationsTab onPlanChange={(p) => setPendingRecs(pendingFromPlan(p))} />}
          {tab === 'history' && <FullHistoryTab />}
          {tab === 'notes' && <NotesTab encounter={encounter.data ?? null} patientName={patient.data.fullName} />}
        </motion.div>
      </div>
    </div>
  );
}

function FirstPaintSkeleton() {
  return (
    <div className="h-screen bg-surface" aria-busy="true">
      <div className="bg-slate-900 px-6 py-3 space-y-3">
        <Skeleton className="h-4 w-48 bg-white/10" />
        <Skeleton className="h-10 w-80 bg-white/10" />
      </div>
      <div className="px-7 py-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="cds-card p-5 space-y-3">
            <Skeleton className="h-3 w-1/3" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-12 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
