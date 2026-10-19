'use client';

import { useEffect, useState } from 'react';
import {
  llmConfigControllerGetKeyStatus,
  llmConfigControllerSetKey,
  llmConfigControllerRemoveKey,
} from '@/lib/sdk/generated';
import { LLM_PROVIDERS } from '@hs/ai';
import { Button } from '@/components/button';

// LLM keys are stored in Secrets Manager — never in DB. The backend never
// returns key values; this UI only knows whether a key is configured per
// provider. Self-hosted providers (Ollama, Bedrock, vLLM) don't need keys
// and are filtered out of the actionable list.

interface LLMConfigTabProps {
  appId: string;
  isReadonly: boolean;
  toast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const KEY_REQUIRED_PROVIDERS = Object.entries(LLM_PROVIDERS)
  .filter(([, info]) => !info.noKeyRequired)
  .map(([id, info]) => ({ id, name: info.name }));

const errMsg = (err: unknown, fallback: string): string =>
  (err as { message?: string } | undefined)?.message ?? fallback;

type PendingAction =
  | { kind: 'set'; provider: string; name: string }
  | { kind: 'remove'; provider: string; name: string }
  | null;

export default function LLMConfigTab({ appId, isReadonly, toast }: LLMConfigTabProps) {
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingAction>(null);

  useEffect(() => {
    loadStatus();
  }, [appId]);

  async function loadStatus() {
    setLoading(true);
    try {
      const { data, error: err } = await llmConfigControllerGetKeyStatus({ path: { appId } });
      if (err) throw new Error(errMsg(err, 'Failed to load LLM key status'));
      setStatus((data as Record<string, boolean>) ?? {});
      setError('');
    } catch (e) {
      setError(errMsg(e, 'Failed to load LLM key status'));
    } finally {
      setLoading(false);
    }
  }

  async function commitSetKey(provider: string, providerName: string, apiKey: string) {
    try {
      const { error: err } = await llmConfigControllerSetKey({
        path: { appId, provider },
        body: { apiKey },
      });
      if (err) throw new Error(errMsg(err, 'Failed to set key'));
      toast(`${providerName} API key configured`, 'success');
      setStatus((prev) => ({ ...prev, [provider]: true }));
    } catch (e) {
      toast(errMsg(e, 'Failed to set key'), 'error');
    }
  }

  async function commitRemoveKey(provider: string, providerName: string) {
    try {
      const { error: err } = await llmConfigControllerRemoveKey({ path: { appId, provider } });
      if (err) throw new Error(errMsg(err, 'Failed to remove key'));
      toast(`${providerName} API key removed`, 'success');
      setStatus((prev) => ({ ...prev, [provider]: false }));
    } catch (e) {
      toast(errMsg(e, 'Failed to remove key'), 'error');
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {KEY_REQUIRED_PROVIDERS.map((p) => (
          <div key={p.id} className="h-16 bg-surface-container-low rounded-round-four" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="aegis-card p-5">
        <h3 className="text-base font-bold text-surface-on">LLM Provider Keys</h3>
        <p className="text-xs text-surface-on-variant mt-1 mb-4">
          Per-application API keys for hosted LLM providers. Keys are stored in Secrets Manager and never returned to
          the UI — only the configured/unconfigured status is shown.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded mb-3">{error}</div>
        )}

        <div className="space-y-2">
          {KEY_REQUIRED_PROVIDERS.map((p) => {
            const configured = !!status[p.id];
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-round-four border border-surface-container-DEFAULT bg-surface-container-low/30"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-surface-on">{p.name}</span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      configured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {configured ? 'Configured' : 'Not configured'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={configured ? 'secondary' : 'primary'}
                    disabled={isReadonly}
                    onClick={() => setPending({ kind: 'set', provider: p.id, name: p.name })}
                  >
                    {configured ? 'Replace' : 'Set Key'}
                  </Button>
                  {configured && (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={isReadonly}
                      onClick={() => setPending({ kind: 'remove', provider: p.id, name: p.name })}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-surface-on-variant/70 mt-4">
          Self-hosted providers (Ollama, vLLM) and AWS Bedrock don&apos;t require keys here — configure those at the
          deployment / IAM level.
        </p>
      </div>

      {pending?.kind === 'set' && (
        <SetKeyModal
          providerName={pending.name}
          isReplace={!!status[pending.provider]}
          onCancel={() => setPending(null)}
          onConfirm={async (key) => {
            await commitSetKey(pending.provider, pending.name, key);
            setPending(null);
          }}
        />
      )}

      {pending?.kind === 'remove' && (
        <RemoveKeyModal
          providerName={pending.name}
          onCancel={() => setPending(null)}
          onConfirm={async () => {
            await commitRemoveKey(pending.provider, pending.name);
            setPending(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Inline modals ──────────────────────────────────────────────────────────
//
// Self-contained modals (kept in this file because LLMConfigTab is the only
// consumer). admin-ui has no shared Modal component yet — when a second
// caller appears, lift these into `apps/admin-ui/src/components/`.

function SetKeyModal({
  providerName,
  isReplace,
  onCancel,
  onConfirm,
}: {
  providerName: string;
  isReplace: boolean;
  onCancel: () => void;
  onConfirm: (key: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell onCancel={onCancel} titleId="llm-set-key-title">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h4 id="llm-set-key-title" className="text-base font-bold text-surface-on">
            {isReplace ? 'Replace' : 'Set'} {providerName} API key
          </h4>
          <p className="text-xs text-surface-on-variant mt-1">
            The key is stored in Secrets Manager and never displayed back to the UI.
          </p>
        </div>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-…"
          className="w-full px-3 py-2 border border-surface-container-DEFAULT rounded-round-four bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" size="sm" disabled={submitting} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={!value.trim() || submitting} loading={submitting}>
            {isReplace ? 'Replace' : 'Save'}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function RemoveKeyModal({
  providerName,
  onCancel,
  onConfirm,
}: {
  providerName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell onCancel={onCancel} titleId="llm-remove-key-title">
      <h4 id="llm-remove-key-title" className="text-base font-bold text-surface-on">
        Remove {providerName} API key?
      </h4>
      <p className="text-xs text-surface-on-variant mt-1 mb-4">
        The application will stop being able to call {providerName} until a new key is configured. This cannot be
        undone.
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" disabled={submitting} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" size="sm" disabled={submitting} loading={submitting} onClick={handleConfirm}>
          Remove
        </Button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  onCancel,
  titleId,
  children,
}: {
  onCancel: () => void;
  titleId: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="bg-white rounded-round-four shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
