'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnalysisStatus } from '@/hooks/useAnalysisStatus';

const SUCCESS_AUTO_DISMISS_MS = 8000;

/**
 * Site-wide indicator for the long-running care plan analysis.
 *
 * - `pending` / `analyzing` → persistent shimmer pill with a deep-link to
 *   the patient's analysis page so the user can return at any time
 * - `complete` → success toast that auto-dismisses after 8s
 * - `error` → red toast that stays until dismissed
 *
 * Sits in the layout shell so it follows the user across pages — the whole
 * point is that closing the analysis tab doesn't lose the in-progress
 * signal.
 */
export function AnalysisStatusBanner() {
  const { status, error, patientId, acknowledge, isAnalyzing } = useAnalysisStatus();

  // Auto-dismiss successful completion so the banner doesn't linger.
  useEffect(() => {
    if (status !== 'complete') return;
    const timer = setTimeout(acknowledge, SUCCESS_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [status, acknowledge]);

  return (
    <AnimatePresence>
      {isAnalyzing && (
        <motion.div
          key="analyzing"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-5 right-5 z-50 max-w-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-primary/20 shadow-floating">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary animate-pulse-subtle" style={{ fontSize: 18 }}>
                magic_button
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-surface-on">Generating AI care plan…</p>
              <p className="text-[11px] text-secondary leading-tight">
                {status === 'pending' ? 'Queued · gathering clinical data' : 'Analyzing patient context'}
              </p>
            </div>
            {patientId && (
              <Link
                href={`/app/patient/${patientId}/analysis`}
                className="text-xs font-semibold text-primary hover:text-primary-dim shrink-0 ml-2"
              >
                View →
              </Link>
            )}
          </div>
        </motion.div>
      )}

      {status === 'complete' && patientId && (
        <motion.div
          key="complete"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-5 right-5 z-50 max-w-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 shadow-floating">
            <span className="material-symbols-outlined text-emerald-600 shrink-0" style={{ fontSize: 22 }}>
              check_circle
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-emerald-800">Care plan ready</p>
              <p className="text-[11px] text-emerald-700/80">Saved as draft — review and approve.</p>
            </div>
            <Link
              href={`/app/patient/${patientId}/analysis`}
              onClick={acknowledge}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 shrink-0 ml-1"
            >
              View →
            </Link>
            <button
              type="button"
              onClick={acknowledge}
              aria-label="Dismiss"
              className="text-emerald-700/60 hover:text-emerald-900 shrink-0"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                close
              </span>
            </button>
          </div>
        </motion.div>
      )}

      {status === 'error' && (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-5 right-5 z-50 max-w-sm"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 shadow-floating">
            <span className="material-symbols-outlined text-red-600 shrink-0" style={{ fontSize: 22 }}>
              error
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-800">Analysis failed</p>
              <p className="text-[11px] text-red-700/80 break-words">
                {error || 'The analysis could not complete. Try again from the patient page.'}
              </p>
            </div>
            <button
              type="button"
              onClick={acknowledge}
              aria-label="Dismiss"
              className="text-red-700/60 hover:text-red-900 shrink-0"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                close
              </span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
