'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  applicationControllerListApplications,
  applicationControllerCreateApplication,
  applicationControllerUpdateJwks,
  applicationControllerEnableApplication,
  ehrConfigControllerListEhrAccess,
  ehrConfigControllerGetAllPlatformScopes,
  ehrConfigControllerUpsertEhrAccess,
} from '@/lib/sdk/generated';
import { useToast } from '@/components/toast';
import { CopyButton } from '@/components/copy-button';
import { Button } from '@/components/button';
import { getCreateableAppTypes, getAllEhrDefinitions, type AppTypeDefinition } from '@hs/config';
import type { Application, AppEhrAccess } from '@/types';

const ALL_EHRS = getAllEhrDefinitions();

type AuthMethod = 'client_secret' | 'jwks';

const GRANT_TYPE_LABELS: Record<string, string> = {
  client_credentials: 'Client Secret',
  'urn:ietf:params:oauth:grant-type:jwt-bearer': 'JWKS Assertion',
};

const CREATEABLE_TYPES = getCreateableAppTypes();

export default function ApplicationsPage() {
  const { toast } = useToast();
  const [apps, setApps] = useState<Application[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  // Step 1: App type selection
  const [selectedType, setSelectedType] = useState<AppTypeDefinition | null>(null);

  // Step 2: Common fields
  const [name, setName] = useState('');
  const [tokenLifetime, setTokenLifetime] = useState(3600);

  // Bridge-specific
  const [authMethod, setAuthMethod] = useState<AuthMethod>('client_secret');
  const [clientType, setClientType] = useState<'CONFIDENTIAL' | 'PUBLIC'>('CONFIDENTIAL');
  const [ehrAppType, setEhrAppType] = useState<'system' | 'provider-ehr' | 'provider-standalone'>('system');
  const [smartLaunchUrl, setSmartLaunchUrl] = useState('');
  const [redirectUris, setRedirectUris] = useState('');
  const [jwksUri, setJwksUri] = useState('');
  const [jwksUriValid, setJwksUriValid] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [jwksUriError, setJwksUriError] = useState('');
  const [jwksKeysSummary, setJwksKeysSummary] = useState('');
  const jwksDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Workflow-specific
  const [workflowEhr, setWorkflowEhr] = useState('');

  // Scopes
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [scopeInfo, setScopeInfo] = useState<{
    scopes: string[];
    capabilities: Record<string, { read: boolean; write: boolean }>;
  } | null>(null);

  // Result
  const [newApp, setNewApp] = useState<
    (Application & { clientSecret?: string; authMethod?: string; hasJwks?: boolean }) | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // View modal
  const [viewApp, setViewApp] = useState<Application | null>(null);
  const [viewAppEhrs, setViewAppEhrs] = useState<AppEhrAccess[]>([]);

  useEffect(() => {
    loadApps();
    ehrConfigControllerGetAllPlatformScopes()
      .then(({ data }) => {
        if (data) setScopeInfo(data as any);
      })
      .catch(() => {});
  }, []);

  async function loadApps() {
    const { data: res } = await applicationControllerListApplications();
    setApps((res as any)?.data ?? []);
  }

  function resetForm() {
    setSelectedType(null);
    setName('');
    setAuthMethod('client_secret');
    setClientType('CONFIDENTIAL');
    setEhrAppType('system');
    setSmartLaunchUrl('');
    setRedirectUris('');
    setTokenLifetime(3600);
    setSelectedScopes([]);
    setWorkflowEhr('');
    setJwksUri('');
    setJwksUriValid('idle');
    setJwksUriError('');
    setJwksKeysSummary('');
    if (jwksDebounceRef.current) clearTimeout(jwksDebounceRef.current);
    setError('');
    setNewApp(null);
  }

  function handleJwksUriChange(value: string) {
    setJwksUri(value);
    setJwksUriValid('idle');
    setJwksUriError('');
    setJwksKeysSummary('');
    if (jwksDebounceRef.current) clearTimeout(jwksDebounceRef.current);

    if (!value.trim()) return;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(value.trim());
    } catch {
      setJwksUriValid('invalid');
      setJwksUriError('Invalid URL format');
      return;
    }
    if (parsedUrl.protocol !== 'https:') {
      setJwksUriValid('invalid');
      setJwksUriError('JWKS URL must use HTTPS');
      return;
    }

    setJwksUriValid('checking');
    jwksDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(value.trim(), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          setJwksUriValid('invalid');
          setJwksUriError(`URL returned HTTP ${res.status}`);
          return;
        }
        const body = await res.json();
        if (!body || !Array.isArray(body.keys) || body.keys.length === 0) {
          setJwksUriValid('invalid');
          setJwksUriError('Response must contain a non-empty "keys" array');
          return;
        }
        const invalidKey = body.keys.find((k: any) => !k.kty);
        if (invalidKey) {
          setJwksUriValid('invalid');
          setJwksUriError('One or more keys missing "kty" field');
          return;
        }
        setJwksUriValid('valid');
        setJwksKeysSummary(
          `${body.keys.length} key(s): ${body.keys.map((k: any) => `${k.kty}/${k.alg || '?'}`).join(', ')}`,
        );
      } catch (err: any) {
        if (err.name === 'TimeoutError') {
          setJwksUriValid('invalid');
          setJwksUriError('Request timed out');
        } else if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
          setJwksUriValid('idle');
          setJwksKeysSummary('CORS prevented browser verification — server will validate on save');
        } else {
          setJwksUriValid('invalid');
          setJwksUriError(err.message || 'Failed to fetch JWKS');
        }
      }
    }, 1000);
  }

  async function openAppModal(app: Application) {
    setViewApp(app);
    try {
      const { data: ehrs } = await ehrConfigControllerListEhrAccess({ path: { appId: app.id } });
      setViewAppEhrs((ehrs as any) ?? []);
    } catch {
      setViewAppEhrs([]);
    }
  }

  function getGrantTypes(): string[] {
    if (authMethod === 'jwks') return ['urn:ietf:params:oauth:grant-type:jwt-bearer'];
    return ['client_credentials'];
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!selectedType) {
      setError('Please select an application type');
      return;
    }

    if (selectedType.appType === 'WORKFLOW' && !workflowEhr) {
      setError('Please select an EHR vendor for this workflow application');
      return;
    }

    if (ehrAppType !== 'system' && !smartLaunchUrl.trim()) {
      setError('Smart Launch URL is required for provider/patient applications');
      return;
    }

    let jwksUriValue: string | undefined;
    if (authMethod === 'jwks') {
      if (!jwksUri.trim()) {
        setError('JWKS URL is required for JWT Bearer authentication');
        return;
      }
      try {
        const parsed = new URL(jwksUri.trim());
        if (parsed.protocol !== 'https:') {
          setError('JWKS URL must use HTTPS');
          return;
        }
      } catch {
        setError('Invalid URL format');
        return;
      }
      jwksUriValue = jwksUri.trim();
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        appType: selectedType.appType,
        clientType: selectedType.requiresClientType ? clientType : 'CONFIDENTIAL',
        allowedGrantTypes: getGrantTypes(),
        scopes: selectedType.showsScopeSelection ? selectedScopes : [],
        tokenLifetime,
      };

      if (ehrAppType !== 'system' && smartLaunchUrl.trim()) {
        payload.smartLaunchUrl = smartLaunchUrl.trim();
      }
      if (selectedType.showsRedirectUris && redirectUris.trim()) {
        payload.redirectUris = redirectUris
          .split('\n')
          .map((u) => u.trim())
          .filter(Boolean);
      }

      const { data, error: createError } = await applicationControllerCreateApplication({ body: payload as any });
      if (createError || !data) throw new Error((createError as any)?.message || 'Failed to create application');

      if (jwksUriValue) {
        await applicationControllerUpdateJwks({
          path: { id: (data as any).id },
          body: { jwksUri: jwksUriValue },
        } as any);
      }

      if (selectedType.appType === 'WORKFLOW' && workflowEhr) {
        await ehrConfigControllerUpsertEhrAccess({
          path: { appId: (data as any).id, ehrName: workflowEhr },
          body: { ehrConfig: {} },
        } as any).catch(() => {});
      }

      setNewApp({ ...(data as any), authMethod, hasJwks: !!jwksUriValue });
      loadApps();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getAuthMethodLabel(app: Application): string {
    const grants = app.allowedGrantTypes || [];
    const hasSecret = grants.includes('client_credentials');
    const hasJwt = grants.includes('urn:ietf:params:oauth:grant-type:jwt-bearer');
    if (hasSecret && hasJwt) return 'Secret + JWKS';
    if (hasJwt) return 'JWKS';
    return 'Client Secret';
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-surface-on">Applications</h1>
          <p className="text-sm text-surface-on-variant mt-1">Manage your clinical integrations and OAuth clients</p>
        </div>
        <Button
          variant={showCreate ? 'secondary' : 'primary'}
          onClick={() => {
            setShowCreate(!showCreate);
            resetForm();
          }}
        >
          {showCreate ? 'Close Form' : 'Register New Application'}
        </Button>
      </div>

      {showCreate && (
        <div className="aegis-card p-8 animate-in fade-in slide-in-from-top-4 duration-300">
          {!newApp && error && (
            <div className="bg-error-container text-error-dim p-3 rounded-round-four text-xs mb-6 flex items-center gap-2">
              <span>&#10007;</span> {error}
            </div>
          )}

          {/* Step 1: Type Selection */}
          {!newApp && !selectedType && (
            <div>
              <h3 className="text-lg font-bold text-surface-on mb-4">Choose application type</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CREATEABLE_TYPES.map((typeDef) => (
                  <button
                    key={typeDef.appType}
                    type="button"
                    onClick={() => {
                      setSelectedType(typeDef);
                      setEhrAppType(typeDef.defaultEhrAppType);
                      setClientType(typeDef.requiresClientType ? 'CONFIDENTIAL' : 'CONFIDENTIAL');
                    }}
                    className="aegis-section text-left hover:bg-surface-container-DEFAULT transition-all group"
                  >
                    <p className="text-lg font-bold text-primary group-hover:text-primary-dim">{typeDef.label}</p>
                    <p className="text-sm text-surface-on-variant mt-1 leading-relaxed">{typeDef.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {typeDef.maxEhrAccess === -1 ? (
                        <span className="badge badge-production">Multi-EHR</span>
                      ) : (
                        <span className="badge badge-sandbox">Single EHR</span>
                      )}
                      {typeDef.supportsSmartLaunch && (
                        <span className="badge bg-purple-100 text-purple-700">SMART Launch</span>
                      )}
                      {typeDef.supportsWorkflows && <span className="badge badge-active">Workflows</span>}
                      {typeDef.supportsLlm && <span className="badge bg-orange-100 text-orange-700">AI/LLM</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Configuration Form */}
          {!newApp && selectedType && (
            <form onSubmit={handleCreate} className="space-y-6 max-w-2xl">
              <div className="flex items-center justify-between mb-4 bg-surface-container-low p-3 rounded-round-four">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedType(null)}
                    className="text-primary font-semibold text-sm hover:underline flex items-center gap-1"
                  >
                    &larr; Back
                  </button>
                  <h3 className="font-bold text-surface-on text-lg">New {selectedType.label} App</h3>
                </div>
                <span className="badge bg-surface-container-highest text-surface-on-variant">
                  {selectedType.appType}
                </span>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5 ml-1">
                  Application Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="aegis-input"
                  placeholder="e.g., Patient Monitor v2"
                />
              </div>

              {/* Auth Method — radio buttons (exclusive) */}
              {clientType === 'CONFIDENTIAL' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5 ml-1">
                    Authentication Method
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="authMethod"
                        checked={authMethod === 'client_secret'}
                        onChange={() => setAuthMethod('client_secret')}
                        className="border-gray-300"
                      />
                      <span className="text-sm">Client Secret</span>
                      <span className="text-xs text-surface-on-variant">(client_id + secret)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="authMethod"
                        checked={authMethod === 'jwks'}
                        onChange={() => setAuthMethod('jwks')}
                        className="border-gray-300"
                      />
                      <span className="text-sm">JWKS</span>
                      <span className="text-xs text-surface-on-variant">(signed JWT + public key)</span>
                    </label>
                  </div>
                </div>
              )}
              {clientType === 'PUBLIC' && (
                <p className="text-[10px] text-surface-on-variant ml-1">
                  Public apps authenticate using client_id only — no secret or JWKS required.
                </p>
              )}

              {/* EHR Vendor — WORKFLOW only */}
              {selectedType.appType === 'WORKFLOW' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5 ml-1">
                    EHR Vendor <span className="text-error font-bold">*</span>
                  </label>
                  <select
                    value={workflowEhr}
                    onChange={(e) => setWorkflowEhr(e.target.value)}
                    className="aegis-input cursor-pointer"
                    required
                  >
                    <option value="">Select clinical system...</option>
                    {ALL_EHRS.map((ehr) => (
                      <option key={ehr.ehrName} value={ehr.ehrName}>
                        {ehr.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-surface-on-variant mt-1.5 ml-1 leading-tight">
                    Workflow applications bind to a single EHR. This configuration is final.
                  </p>
                </div>
              )}

              {/* JWKS URL Input */}
              {clientType === 'CONFIDENTIAL' && authMethod === 'jwks' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5 ml-1">
                    JWKS URL <span className="text-error font-bold">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={jwksUri}
                      onChange={(e) => handleJwksUriChange(e.target.value)}
                      className="aegis-input pr-10"
                      placeholder="https://auth.provider.com/.well-known/jwks.json"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                      {jwksUriValid === 'checking' && (
                        <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                      )}
                      {jwksUriValid === 'valid' && (
                        <span className="text-green-500 font-bold" title="Verified">
                          &#10003;
                        </span>
                      )}
                      {jwksUriValid === 'invalid' && (
                        <span className="text-error font-bold" title="Invalid">
                          &#10007;
                        </span>
                      )}
                    </div>
                  </div>
                  {jwksUriValid === 'invalid' && (
                    <p className="text-[10px] text-error mt-1 ml-1 font-medium">{jwksUriError}</p>
                  )}
                  {jwksUriValid === 'valid' && jwksKeysSummary && (
                    <p className="text-[10px] text-green-600 mt-1 ml-1 font-medium">{jwksKeysSummary}</p>
                  )}
                  <p className="text-[10px] text-surface-on-variant mt-1.5 ml-1">
                    HTTPS only. Validated automatically after you stop typing.
                  </p>
                </div>
              )}

              {/* Scopes */}
              {selectedType.showsScopeSelection && scopeInfo && (
                <div className="aegis-section">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-secondary">FHIR Scopes</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedScopes([...scopeInfo.scopes])}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        SELECT ALL
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedScopes([])}
                        className="text-[10px] font-bold text-secondary hover:underline"
                      >
                        CLEAR
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {Object.entries(scopeInfo.capabilities).map(([resource, caps]) => (
                      <div
                        key={resource}
                        className="flex items-center justify-between text-xs py-1 border-b border-surface-container-DEFAULT last:border-0"
                      >
                        <span className="font-bold text-surface-on">{resource}</span>
                        <div className="flex gap-4">
                          {caps.read && (
                            <label className="flex items-center gap-1.5 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={selectedScopes.includes(`FHIR.R4/${resource}.read`)}
                                onChange={() =>
                                  setSelectedScopes((prev) =>
                                    prev.includes(`FHIR.R4/${resource}.read`)
                                      ? prev.filter((s) => s !== `FHIR.R4/${resource}.read`)
                                      : [...prev, `FHIR.R4/${resource}.read`],
                                  )
                                }
                                className="w-3.5 h-3.5 rounded border-surface-container-highest text-primary focus:ring-primary"
                              />
                              <span className="group-hover:text-primary transition-colors">Read</span>
                            </label>
                          )}
                          {caps.write && (
                            <label className="flex items-center gap-1.5 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={selectedScopes.includes(`FHIR.R4/${resource}.write`)}
                                onChange={() =>
                                  setSelectedScopes((prev) =>
                                    prev.includes(`FHIR.R4/${resource}.write`)
                                      ? prev.filter((s) => s !== `FHIR.R4/${resource}.write`)
                                      : [...prev, `FHIR.R4/${resource}.write`],
                                  )
                                }
                                className="w-3.5 h-3.5 rounded border-surface-container-highest text-primary focus:ring-primary"
                              />
                              <span className="group-hover:text-primary transition-colors">Write</span>
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4 items-center pt-4 border-t border-surface-container-low">
                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  loadingText="Creating..."
                  className="min-w-[160px]"
                >
                  Create Application
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowCreate(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Success Card */}
          {newApp && (
            <div className="aegis-section bg-primary-container/30 border-0 animate-in zoom-in-95 duration-300">
              <div className="flex items-start gap-3 mb-6">
                <div className="bg-primary text-white p-1 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-primary-dim">Application Created Successfully</h3>
                  <p className="text-sm text-surface-on-variant">New client credentials have been generated.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white/50 p-4 rounded-round-four border border-primary/10">
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">
                    Client ID
                  </label>
                  <div className="flex items-center justify-between gap-4">
                    <code className="text-sm font-mono text-surface-on bg-surface-container-low px-2 py-1 rounded truncate flex-1">
                      {newApp.clientId}
                    </code>
                    <CopyButton
                      text={newApp.clientId}
                      className="text-primary hover:text-primary-dim p-1.5 hover:bg-primary/5 rounded transition-colors"
                      iconClassName="w-5 h-5"
                    />
                  </div>
                </div>

                {newApp.authMethod !== 'jwks' && newApp.clientSecret && (
                  <div className="bg-white/50 p-4 rounded-round-four border border-primary/10">
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">
                      Client Secret
                    </label>
                    <div className="flex items-center justify-between gap-4">
                      <code className="text-sm font-mono text-surface-on bg-surface-container-low px-2 py-1 rounded truncate flex-1">
                        {newApp.clientSecret}
                      </code>
                      <CopyButton
                        text={newApp.clientSecret!}
                        className="text-primary hover:text-primary-dim p-1.5 hover:bg-primary/5 rounded transition-colors"
                        iconClassName="w-5 h-5"
                      />
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-error font-bold text-[10px] uppercase">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Store this secret securely. It will not be shown again.
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-end">
                <Button
                  variant="primary"
                  className="px-12"
                  onClick={() => {
                    setShowCreate(false);
                    resetForm();
                  }}
                >
                  DONE
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Applications Table */}
      <div className="aegis-card">
        <div className="p-4 bg-surface-container-low/30 border-b border-surface-container-DEFAULT flex items-center justify-between">
          <h2 className="text-sm font-bold text-secondary uppercase tracking-widest">Active Integrations</h2>
          <span className="badge badge-production">{apps.length} Total</span>
        </div>
        <table className="aegis-table">
          <thead>
            <tr>
              <th className="pl-6">Integration Name</th>
              <th>Identity (Client ID)</th>
              <th>Auth Strategy</th>
              <th>EHR Access</th>
              <th className="pr-6">Availability</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <tr key={app.id} className="cursor-pointer group" onClick={() => openAppModal(app)}>
                <td className="pl-6 font-bold text-primary group-hover:text-primary-dim transition-colors">
                  {app.name}
                </td>
                <td>
                  <code className="text-[11px] font-mono text-surface-on-variant">{app.clientId}</code>
                </td>
                <td>
                  <span className="text-[10px] font-bold text-secondary uppercase bg-surface-container-highest px-2 py-0.5 rounded">
                    {getAuthMethodLabel(app)}
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {app.ehrAccess?.map((e: any) => (
                      <span key={e.ehrName} className="badge badge-sandbox lowercase">
                        {e.ehrName}
                      </span>
                    ))}
                    {(!app.ehrAccess || app.ehrAccess.length === 0) && (
                      <span className="text-[10px] text-gray-400 italic">None</span>
                    )}
                  </div>
                </td>
                <td className="pr-6">
                  <span className={`badge ${app.status === 'ACTIVE' ? 'badge-active' : 'badge-disabled'}`}>
                    {app.status}
                  </span>
                </td>
              </tr>
            ))}
            {apps.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-surface-on-variant italic">
                  No applications found in this organization.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Details Modal (Preserved logic, updated style) */}
      {viewApp && (
        <div
          className="fixed inset-0 bg-surface-on/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setViewApp(null);
            setViewAppEhrs([]);
          }}
        >
          <div
            className="aegis-card w-full max-w-lg animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 bg-surface-container-low/50 border-b border-surface-container-DEFAULT">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-surface-on">{viewApp.name}</h2>
                <span className={`badge ${viewApp.status === 'ACTIVE' ? 'badge-active' : 'badge-disabled'}`}>
                  {viewApp.status}
                </span>
              </div>
              <button
                onClick={() => {
                  setViewApp(null);
                  setViewAppEhrs([]);
                }}
                className="text-secondary hover:text-surface-on p-1 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">
                    Client ID
                  </label>
                  <code className="text-xs font-mono text-surface-on bg-surface-container-low px-2 py-1 rounded break-all block">
                    {viewApp.clientId}
                  </code>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">
                    Auth Strategy
                  </label>
                  <p className="text-sm font-bold text-primary">{getAuthMethodLabel(viewApp)}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">
                    Token Lifetime
                  </label>
                  <p className="text-sm text-surface-on font-medium">{viewApp.tokenLifetime} seconds</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">
                    Created
                  </label>
                  <p className="text-sm text-surface-on font-medium">
                    {new Date(viewApp.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {viewApp.jwks?.uri && (
                <div className="aegis-section">
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">
                    JWKS Endpoint
                  </label>
                  <code className="text-xs font-mono text-surface-on-variant break-all">{viewApp.jwks.uri}</code>
                  <div className="mt-2 text-[10px] font-bold text-primary uppercase flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4.13-5.69Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {viewApp.jwks.keys?.length ?? 0} Keys Verified
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-3">
                  Configured Clinical Access
                </label>
                {viewAppEhrs.length > 0 ? (
                  <div className="space-y-2">
                    {viewAppEhrs.map((e) => (
                      <div
                        key={e.ehrName}
                        className="flex items-center justify-between bg-surface-container-low p-3 rounded-round-four"
                      >
                        <div>
                          <p className="font-bold text-sm text-surface-on capitalize">{e.ehrName}</p>
                          <p className="text-[10px] font-medium text-surface-on-variant mt-0.5">
                            {e.ehrTokenScopes?.length || 0} Scopes
                          </p>
                        </div>
                        <span className={`badge ${e.status === 'ACTIVE' ? 'badge-active' : 'badge-disabled'}`}>
                          {e.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-surface-on-variant italic">
                    No EHR integrations configured for this client.
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-surface-container-low/50 border-t border-surface-container-DEFAULT flex justify-between items-center">
              <Button
                variant="secondary"
                onClick={() => {
                  setViewApp(null);
                  setViewAppEhrs([]);
                }}
              >
                Dismiss
              </Button>
              <div className="flex gap-3">
                {viewApp.status === 'DISABLED' && (
                  <Button
                    variant="success"
                    size="sm"
                    confirmMessage="Re-enable this application?"
                    onClick={async () => {
                      try {
                        const { error: enableErr } = await applicationControllerEnableApplication({
                          path: { id: viewApp.id },
                        });
                        if (enableErr) throw new Error((enableErr as any)?.message || 'Failed to re-enable');
                        toast('Application re-enabled', 'success');
                        setViewApp(null);
                        setViewAppEhrs([]);
                        loadApps();
                      } catch (err: any) {
                        toast(err.message || 'Failed to re-enable', 'error');
                      }
                    }}
                  >
                    RE-ENABLE
                  </Button>
                )}
                <Link href={`/dashboard/applications/${viewApp.id}`} className="btn-primary flex items-center gap-2">
                  MANAGE INTEGRATION
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path
                      fillRule="evenodd"
                      d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
