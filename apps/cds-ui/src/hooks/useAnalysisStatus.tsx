'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CdsCard } from '@/types';
import { useSession } from './useSession';

/**
 * Real-time analysis status, fed by the cds-app `/analysis/events` SSE stream.
 *
 * Why a global context: care plan generation runs server-side and persists
 * its progress in Redis. The user can navigate away from the analysis page
 * and back, and we want them to see the in-progress state immediately —
 * not the "Generate" button. Polling from every page would be wasteful;
 * one SSE connection per session is the right primitive.
 */

export type AnalysisStatusValue = 'idle' | 'pending' | 'analyzing' | 'complete' | 'error';

export interface AnalysisStatusEvent {
  providerSessionId: string;
  patientId?: string;
  encounterId?: string;
  status: AnalysisStatusValue;
  cards?: CdsCard[];
  error?: string;
}

interface AnalysisStatusContextValue {
  status: AnalysisStatusValue;
  cards: CdsCard[] | null;
  error: string | null;
  patientId: string | undefined;
  /** True while the server has an in-flight analysis (pending → analyzing). */
  isAnalyzing: boolean;
  /** Force-clear the local view of a completed/errored analysis. Doesn't touch server state. */
  acknowledge: () => void;
  /** Optimistically mark "pending" the moment we kick off /analysis/start so the banner appears instantly. */
  markStarted: () => void;
}

const Ctx = createContext<AnalysisStatusContextValue>({
  status: 'idle',
  cards: null,
  error: null,
  patientId: undefined,
  isAnalyzing: false,
  acknowledge: () => {},
  markStarted: () => {},
});

const CDS_API_URL = process.env.NEXT_PUBLIC_CDS_API_URL || 'http://localhost:3003';

export function AnalysisStatusProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const [event, setEvent] = useState<AnalysisStatusEvent | null>(null);
  const [acknowledged, setAcknowledged] = useState<AnalysisStatusValue | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  // Open / close the SSE connection alongside the session lifecycle.
  useEffect(() => {
    if (loading || !session) {
      sourceRef.current?.close();
      sourceRef.current = null;
      setEvent(null);
      return;
    }

    const url = `${CDS_API_URL}/api/analysis/events`;
    const es = new EventSource(url, { withCredentials: true });
    sourceRef.current = es;

    es.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as AnalysisStatusEvent;
        setEvent(parsed);
        // Reset acknowledgement whenever a fresh terminal status arrives —
        // a new completion should re-show the success banner even if the
        // user dismissed the previous one.
        setAcknowledged(null);
      } catch {
        /* malformed event — ignore */
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects on transient errors. We don't surface
      // a UI error here — the next successful event will repaint state.
    };

    return () => {
      es.close();
      sourceRef.current = null;
    };
  }, [session?.ehrName, session?.launchMode, loading]);

  const acknowledge = useCallback(() => {
    if (event) setAcknowledged(event.status);
  }, [event]);

  const markStarted = useCallback(() => {
    setEvent((prev) => ({
      providerSessionId: prev?.providerSessionId ?? '',
      patientId: prev?.patientId,
      encounterId: prev?.encounterId,
      status: 'pending',
    }));
    setAcknowledged(null);
  }, []);

  const value = useMemo<AnalysisStatusContextValue>(() => {
    const status: AnalysisStatusValue = event?.status ?? 'idle';
    // Hide a previously-acknowledged terminal state from the UI but keep
    // the underlying data in case a component still wants to read cards.
    const visibleStatus: AnalysisStatusValue = acknowledged === status ? 'idle' : status;
    return {
      status: visibleStatus,
      cards: event?.cards ?? null,
      error: event?.error ?? null,
      patientId: event?.patientId,
      isAnalyzing: visibleStatus === 'pending' || visibleStatus === 'analyzing',
      acknowledge,
      markStarted,
    };
  }, [event, acknowledged, acknowledge, markStarted]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnalysisStatus() {
  return useContext(Ctx);
}
