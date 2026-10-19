'use client';

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { fadeIn } from '@/lib/motion';

const CDS_API_URL = process.env.NEXT_PUBLIC_CDS_API_URL || 'http://localhost:3003';

type Step = 'email' | 'otp';

/**
 * System launch tab — email + one-time-code sign-in for headless/system mode.
 *
 * Real flow: request-otp → verify-otp → exchange the returned provider JWT for
 * a CDS session via `POST /launch/system` → redirect to patient search. (The
 * handoff design showed a password field; the backend uses an emailed OTP, so
 * we keep the design's visual treatment over the real two-step OTP flow.)
 */
export default function SystemLaunchPanel() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestOtp = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${CDS_API_URL}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to send code');
      }
      setStep('otp');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  }, [email]);

  const verifyOtp = useCallback(async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${CDS_API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Invalid code');
      }
      const { token } = await res.json();

      // Exchange the provider JWT for a CDS session (system launch).
      const launchRes = await fetch(`${CDS_API_URL}/launch/system`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });
      if (!launchRes.ok) {
        const body = await launchRes.json().catch(() => ({}));
        throw new Error(body.message || 'System launch failed');
      }
      const { redirectUrl } = await launchRes.json();

      // Same-origin redirect only (prevents open redirect).
      const target = new URL(redirectUrl, window.location.origin);
      if (target.origin !== window.location.origin) throw new Error('Invalid redirect URL');
      window.location.href = target.toString();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setLoading(false);
    }
  }, [email, otp]);

  const inputClass =
    'w-full px-3.5 py-2.5 border-[1.5px] border-surface-container rounded-lg text-[13px] text-surface-on bg-white focus:border-primary transition-colors';
  const labelClass = 'block text-[11px] font-semibold text-secondary mb-1.5 tracking-[0.05em] uppercase';

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      {step === 'email' ? (
        <div className="flex flex-col gap-3.5">
          <div>
            <label className={labelClass}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && requestOtp()}
              placeholder="you@hospital.org"
              autoFocus
              className={inputClass}
            />
          </div>
          <button
            onClick={requestOtp}
            disabled={loading || !email}
            className="btn-primary text-[13px] py-2.5 rounded-[10px] mt-0.5 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending…
              </>
            ) : (
              <>
                Send Verification Code
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                  arrow_forward
                </span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="text-center">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 30 }}>
              mail
            </span>
            <p className="text-[13px] text-secondary mt-1.5">
              We sent a 6-digit code to <strong className="text-surface-on">{email}</strong>
            </p>
          </div>
          <div>
            <label className={labelClass}>Verification code</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && verifyOtp()}
              placeholder="000000"
              maxLength={6}
              autoFocus
              className={`${inputClass} text-center font-mono text-lg tracking-[0.4em]`}
            />
          </div>
          <button
            onClick={verifyOtp}
            disabled={loading || otp.length !== 6}
            className="btn-primary text-[13px] py-2.5 rounded-[10px] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                  check
                </span>
                Verify &amp; Sign In
              </>
            )}
          </button>
          <button
            onClick={() => {
              setStep('email');
              setOtp('');
              setError('');
            }}
            className="text-[13px] text-secondary hover:text-surface-on text-center"
          >
            Use a different email
          </button>
        </div>
      )}

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[12px] text-red-700">
          {error}
        </div>
      )}

      <div className="mt-3.5 px-3.5 py-2.5 bg-surface-container-low rounded-lg flex items-start gap-2">
        <span className="material-symbols-outlined text-primary shrink-0 mt-0.5" style={{ fontSize: 14 }}>
          medical_services
        </span>
        <div className="text-[11px] text-secondary leading-relaxed">
          System launch: you will search for a patient and appointment, then select an encounter to open the clinical
          view.
        </div>
      </div>
    </motion.div>
  );
}
