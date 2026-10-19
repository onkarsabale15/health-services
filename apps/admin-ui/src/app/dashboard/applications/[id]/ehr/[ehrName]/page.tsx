'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ehrConfigControllerGetDefinition,
  ehrConfigControllerGetTokenScopes,
  ehrConfigControllerListEhrAccess,
  ehrConfigControllerGetJwksStatus,
  ehrConfigControllerUploadJwks,
  ehrConfigControllerDeleteJwks,
  ehrConfigControllerUpsertEhrAccess,
  ehrConfigControllerListSites,
  ehrConfigControllerCreateSite,
  ehrConfigControllerUpdateSite,
  ehrConfigControllerRemoveSite,
  ehrConfigControllerSetDefaultSite,
  ehrConfigControllerListProviders,
  ehrConfigControllerUpdateProvider,
  ehrConfigControllerRemoveProvider,
} from '@/lib/sdk/generated';
import { useToast } from '@/components/toast';
import { CopyButton } from '@/components/copy-button';
import { Button } from '@/components/button';
import { PasswordToggle } from '@/components/password-toggle';
import { supportsMultiSite } from '@hs/config';
import { getEffectiveAppType, matchesEhrAndAppType } from '@/lib/ehr-access';
import { DeploymentEnvBadge } from '@/components/deployment-env-badge';

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'url' | 'password' | 'json' | 'jwk' | 'select' | 'boolean' | 'textarea';
  required: boolean;
  sensitive: boolean;
  group: string;
  placeholder?: string;
  description?: string;
  defaultValue?: any;
  options?: { value: string; label: string; description?: string }[];
  dependsOn?: { field: string; value: any };
  perSite?: boolean;
}

interface SiteConfig {
  id: string;
  name: string;
  siteIdentifiers: Record<string, any>;
  siteCredentials?: Record<string, any> | null;
  siteUrls?: Record<string, any> | null;
  isDefault: boolean;
  isActive: boolean;
  isApproved: boolean;
  status: string;
}

interface EhrDefinition {
  ehrName: string;
  label: string;
  fields: FieldDef[];
  supportedAppTypes: string[];
}

interface TokenScopeConfig {
  defaultScope: string;
  options: { value: string; label: string; description?: string }[];
  allowCustom: boolean;
}

// URL field keys that get defaults from centralized EHR_ENDPOINTS (per deployment env)
const URL_FIELD_KEYS = ['baseUrl', 'authUrl'];

export default function EhrConfigPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appId = params.id as string;
  const ehrName = params.ehrName as string;
  const urlAppType = searchParams.get('appType'); // 'system' | 'provider-ehr' | 'provider-standalone' | null (new)
  const { toast } = useToast();

  const [definition, setDefinition] = useState<EhrDefinition | null>(null);
  const [tokenScopeConfig, setTokenScopeConfig] = useState<TokenScopeConfig | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [selectedEhrTokenScopes, setSelectedEhrTokenScopes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingAccess, setExistingAccess] = useState<any>(null);
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  const [jwkStatus, setJwkStatus] = useState<
    Record<string, { configured: boolean; keyType?: string; algorithm?: string; keyId?: string | null }>
  >({});
  const [jwkUploading, setJwkUploading] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  // Multi-site state
  const isMultiSite = supportsMultiSite(ehrName);
  const [sites, setSites] = useState<SiteConfig[]>([]);
  const [showAddSite, setShowAddSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteIdentifiers, setNewSiteIdentifiers] = useState<Record<string, any>>({});
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [editSiteName, setEditSiteName] = useState('');
  const [editSiteIdentifiers, setEditSiteIdentifiers] = useState<Record<string, any>>({});
  // Provider access state (per-site)
  const [siteProviders, setSiteProviders] = useState<Record<string, any[]>>({});
  const [loadingProviders, setLoadingProviders] = useState<Record<string, boolean>>({});
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

  // Track previous defaults so we know which values to replace on appType change
  const prevDefaultsRef = useRef<Record<string, any>>({});

  useEffect(() => {
    loadAll();
  }, [ehrName, appId, urlAppType]);

  async function loadAll() {
    try {
      // Step 1: Load existing EHR access first — we need its appType to fetch the right definition/scopes
      let existingConfig: Record<string, any> = {};
      let hasExisting = false;
      let resolvedAppType = urlAppType || undefined;
      try {
        const { data: allAccess } = await ehrConfigControllerListEhrAccess({ path: { appId } });
        const existing = (allAccess as any[])?.find((a: any) =>
          urlAppType ? matchesEhrAndAppType(a, ehrName, urlAppType) : a.ehrName === ehrName,
        );
        if (existing) {
          hasExisting = true;
          setExistingAccess(existing);
          existingConfig = existing.ehrConfig || {};
          resolvedAppType = getEffectiveAppType(existing) || resolvedAppType;
          setSelectedEhrTokenScopes(existing.ehrTokenScopes || []);
          loadSites(resolvedAppType);
        }
      } catch {}

      // Step 2: Fetch definition + scopes using the resolved appType (matches saved config, or URL query, or EHR default)
      const [defRes, tokenScopesRes] = await Promise.all([
        ehrConfigControllerGetDefinition({
          path: { ehrName },
          query: resolvedAppType ? { appType: resolvedAppType } : undefined,
        } as any),
        ehrConfigControllerGetTokenScopes({
          path: { ehrName },
          query: resolvedAppType ? { appType: resolvedAppType } : undefined,
        } as any),
      ]);
      const defData = defRes.data as any;
      const tokenScopes = tokenScopesRes.data as any;
      if (!defData || !tokenScopes) throw new Error('Failed to load EHR definition');
      setDefinition(defData);
      setTokenScopeConfig(tokenScopes);
      cacheDefaults(defData);

      // Build config: use existing values, fall back to defaultValue from definition
      const mergedConfig: Record<string, any> = {};
      for (const field of defData.fields) {
        if (existingConfig[field.key] !== undefined && existingConfig[field.key] !== '') {
          mergedConfig[field.key] = existingConfig[field.key];
        } else if (field.defaultValue !== undefined) {
          mergedConfig[field.key] = field.defaultValue;
        }
      }
      // appType is authoritative from resolvedAppType — overrides anything in existingConfig
      if (resolvedAppType && defData.fields.some((f: FieldDef) => f.key === 'appType')) {
        mergedConfig.appType = resolvedAppType;
      }
      setConfig(mergedConfig);
      setDefaultsApplied(!hasExisting);

      // Load JWK status — one JWK per (app, ehr) in the deployment env.
      // There's at most one JWK-type field per EHR now (`clientSecret`).
      const jwkFields = defData.fields.filter((f: FieldDef) => f.type === 'jwk');
      if (jwkFields.length > 0) {
        try {
          const { data: status } = await ehrConfigControllerGetJwksStatus({ path: { appId, ehrName } });
          const statusMap: Record<string, any> = {};
          for (const f of jwkFields) {
            statusMap[f.key] = (status as any) ?? { configured: false };
          }
          setJwkStatus(statusMap);
        } catch {
          const statusMap: Record<string, any> = {};
          for (const f of jwkFields) statusMap[f.key] = { configured: false };
          setJwkStatus(statusMap);
        }
      }
    } catch (err: any) {
      toast(err.message || 'Failed to load EHR configuration', 'error');
    }
  }

  /** Cache current field defaults so we can detect which values to update on appType change */
  function cacheDefaults(def: EhrDefinition) {
    const defaults: Record<string, any> = {};
    for (const field of def.fields) {
      if (field.defaultValue !== undefined) {
        defaults[field.key] = field.defaultValue;
      }
    }
    prevDefaultsRef.current = defaults;
  }

  /**
   * When appType changes, re-fetch the enriched definition with appType-specific
   * URL defaults and token scope options. Replace values that were still at their
   * previous defaults with the new defaults.
   */
  async function handleAppTypeChange(newAppType: string) {
    updateConfig('appType', newAppType);
    try {
      const [newDefRes, newTokenScopesRes] = await Promise.all([
        ehrConfigControllerGetDefinition({ path: { ehrName }, query: { appType: newAppType } }),
        ehrConfigControllerGetTokenScopes({ path: { ehrName }, query: { appType: newAppType } }),
      ]);
      const newDef = newDefRes.data as any;
      const newTokenScopes = newTokenScopesRes.data as any;
      if (!newDef || !newTokenScopes) throw new Error('Failed to load appType-specific configuration');
      const oldDefaults = prevDefaultsRef.current;

      setDefinition(newDef);
      setTokenScopeConfig(newTokenScopes);
      cacheDefaults(newDef);

      // Reset selected scopes when app type changes (different scopes per type)
      setSelectedEhrTokenScopes([]);

      // Update URL fields: if current value matches old default, swap to new default
      setConfig((prev) => {
        const updated: Record<string, any> = { ...prev, appType: newAppType };
        for (const field of newDef.fields) {
          if (URL_FIELD_KEYS.includes(field.key)) {
            const currentVal = prev[field.key];
            const wasDefault = currentVal === oldDefaults[field.key] || currentVal === undefined || currentVal === '';
            if (wasDefault && field.defaultValue !== undefined) {
              updated[field.key] = field.defaultValue;
            }
          }
        }
        return updated;
      });
    } catch (err: any) {
      toast(err.message || 'Failed to load appType-specific configuration', 'error');
    }
  }

  function updateConfig(key: string, value: any) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function resetToDefault(key: string) {
    const field = definition?.fields.find((f) => f.key === key);
    if (field?.defaultValue !== undefined) {
      updateConfig(key, field.defaultValue);
    }
  }

  async function handleJwkUpload(fieldKey: string, jwksJson: string) {
    try {
      const jwks = JSON.parse(jwksJson);
      if (!jwks.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
        toast('Invalid JWKS: must contain a "keys" array with at least one key', 'error');
        return;
      }
      setJwkUploading((prev) => ({ ...prev, [fieldKey]: true }));
      const { error: uploadErr } = await ehrConfigControllerUploadJwks({
        path: { appId, ehrName },
        body: { jwks },
      } as any);
      if (uploadErr) throw new Error((uploadErr as any)?.message || 'Failed to upload JWK');
      toast('JWK private key uploaded', 'success');
      // Refresh status
      const { data: status } = await ehrConfigControllerGetJwksStatus({ path: { appId, ehrName } });
      setJwkStatus((prev) => ({ ...prev, [fieldKey]: (status as any) ?? { configured: false } }));
    } catch (err: any) {
      toast(err.message || 'Failed to upload JWK', 'error');
    } finally {
      setJwkUploading((prev) => ({ ...prev, [fieldKey]: false }));
    }
  }

  async function handleJwkDelete(fieldKey: string) {
    try {
      const { error: delErr } = await ehrConfigControllerDeleteJwks({ path: { appId, ehrName } });
      if (delErr) throw new Error((delErr as any)?.message || 'Failed to delete JWK');
      toast('JWK private key deleted', 'success');
      setJwkStatus((prev) => ({ ...prev, [fieldKey]: { configured: false } }));
    } catch (err: any) {
      toast(err.message || 'Failed to delete JWK', 'error');
    }
  }

  function toggleEhrTokenScope(scope: string) {
    setSelectedEhrTokenScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  function selectAllEhrTokenScopes() {
    if (tokenScopeConfig) setSelectedEhrTokenScopes(tokenScopeConfig.options.map((o) => o.value));
  }

  function deselectAllEhrTokenScopes() {
    setSelectedEhrTokenScopes([]);
  }

  // ─── Site Management ───────────────────────────────────

  /** Resolve the effective appType for scoping site calls to the correct AppEhrAccess record. */
  function currentAppType(): string {
    return config.appType || urlAppType || 'system';
  }

  async function loadSites(appType?: string) {
    try {
      const ehrAppType = appType || currentAppType();
      const { data } = await ehrConfigControllerListSites({
        path: { appId, ehrName },
        query: { appType: ehrAppType },
      } as any);
      if (data) setSites(data as any);
    } catch {
      /* non-critical */
    }
  }

  async function handleAddSite() {
    if (!newSiteName.trim()) {
      toast('Site name is required', 'warning');
      return;
    }
    try {
      const { data, error: createErr } = await ehrConfigControllerCreateSite({
        path: { appId, ehrName },
        query: { appType: currentAppType() },
        body: { name: newSiteName.trim(), siteIdentifiers: newSiteIdentifiers },
      } as any);
      if (createErr) throw new Error((createErr as any)?.message || 'Failed to add site');
      setSites((prev) => [...prev, data as any]);
      setShowAddSite(false);
      setNewSiteName('');
      setNewSiteIdentifiers({});
      toast('Site added', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to add site', 'error');
    }
  }

  async function handleUpdateSite(siteId: string) {
    try {
      const { data, error: updateErr } = await ehrConfigControllerUpdateSite({
        path: { appId, ehrName, siteId },
        query: { appType: currentAppType() },
        body: { name: editSiteName.trim(), siteIdentifiers: editSiteIdentifiers },
      } as any);
      if (updateErr) throw new Error((updateErr as any)?.message || 'Failed to update site');
      setSites((prev) => prev.map((s) => (s.id === siteId ? (data as any) : s)));
      setEditingSiteId(null);
      toast('Site updated', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to update site', 'error');
    }
  }

  async function handleDeactivateSite(siteId: string, siteName: string) {
    try {
      const { error: deactivateErr } = await ehrConfigControllerUpdateSite({
        path: { appId, ehrName, siteId },
        query: { appType: currentAppType() },
        body: { isActive: false },
      } as any);
      if (deactivateErr) throw new Error((deactivateErr as any)?.message || 'Failed to deactivate site');
      setSites((prev) => prev.map((s) => (s.id === siteId ? { ...s, isActive: false } : s)));
      toast(`Site "${siteName}" deactivated`, 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to deactivate site', 'error');
    }
  }

  async function handleApproveSite(siteId: string, siteName: string) {
    try {
      const { error: approveErr } = await ehrConfigControllerUpdateSite({
        path: { appId, ehrName, siteId },
        query: { appType: currentAppType() },
        body: { isApproved: true },
      } as any);
      if (approveErr) throw new Error((approveErr as any)?.message || 'Failed to approve site');
      toast(`Site "${siteName}" approved`, 'success');
      await loadSites();
    } catch (err: any) {
      toast(err.message || 'Failed to approve site', 'error');
    }
  }

  async function handleDenySite(siteId: string, siteName: string) {
    try {
      const { error: denyErr } = await ehrConfigControllerRemoveSite({
        path: { appId, ehrName, siteId },
        query: { appType: currentAppType() },
      } as any);
      if (denyErr) throw new Error((denyErr as any)?.message || 'Failed to deny site');
      toast(`Site "${siteName}" denied and deleted`, 'success');
      await loadSites();
    } catch (err: any) {
      toast(err.message || 'Failed to deny site', 'error');
    }
  }

  async function handleActivateSite(siteId: string, siteName: string) {
    try {
      const { error: activateErr } = await ehrConfigControllerUpdateSite({
        path: { appId, ehrName, siteId },
        query: { appType: currentAppType() },
        body: { isActive: true },
      } as any);
      if (activateErr) throw new Error((activateErr as any)?.message || 'Failed to activate site');
      setSites((prev) => prev.map((s) => (s.id === siteId ? { ...s, isActive: true } : s)));
      toast(`Site "${siteName}" activated`, 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to activate site', 'error');
    }
  }

  async function handleSetDefault(siteId: string) {
    try {
      const { error: defaultErr } = await ehrConfigControllerSetDefaultSite({
        path: { appId, ehrName, siteId },
        query: { appType: currentAppType() },
      } as any);
      if (defaultErr) throw new Error((defaultErr as any)?.message || 'Failed to set default');
      setSites((prev) => prev.map((s) => ({ ...s, isDefault: s.id === siteId })));
      toast('Default site updated', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to set default', 'error');
    }
  }

  // ─── Provider Management ────────────────────────────────

  async function loadProviders(siteId: string) {
    setLoadingProviders((prev) => ({ ...prev, [siteId]: true }));
    try {
      const { data } = await ehrConfigControllerListProviders({
        path: { appId, siteId },
      } as any);
      const result = data as any;
      setSiteProviders((prev) => ({ ...prev, [siteId]: result?.providers ?? [] }));
    } catch {
      toast('Failed to load providers', 'error');
    } finally {
      setLoadingProviders((prev) => ({ ...prev, [siteId]: false }));
    }
  }

  function toggleProviders(siteId: string) {
    const isExpanded = expandedProviders[siteId];
    setExpandedProviders((prev) => ({ ...prev, [siteId]: !isExpanded }));
    if (!isExpanded && !siteProviders[siteId]) {
      loadProviders(siteId);
    }
  }

  async function handleApproveProvider(siteId: string, providerId: string) {
    try {
      await ehrConfigControllerUpdateProvider({
        path: { appId, siteId, providerId },
        body: { isApproved: true },
      } as any);
      toast('Provider approved', 'success');
      loadProviders(siteId);
    } catch {
      toast('Failed to approve provider', 'error');
    }
  }

  async function handleDenyProvider(siteId: string, providerId: string) {
    try {
      await ehrConfigControllerRemoveProvider({
        path: { appId, siteId, providerId },
      } as any);
      toast('Provider removed', 'success');
      loadProviders(siteId);
    } catch {
      toast('Failed to remove provider', 'error');
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const effectiveAppType = config.appType || urlAppType || 'system';
      const { error: upsertErr } = await ehrConfigControllerUpsertEhrAccess({
        path: { appId, ehrName },
        body: {
          ehrAppType: effectiveAppType,
          ehrTokenScopes: selectedEhrTokenScopes,
          ehrConfig: { ...config, appType: effectiveAppType },
        },
      } as any);
      if (upsertErr) throw new Error((upsertErr as any)?.message || 'Failed to save EHR configuration');
      toast('EHR configuration saved', 'success');
      router.push(`/dashboard/applications/${appId}`);
    } catch (err: any) {
      const msg = typeof err.message === 'string' ? err.message : JSON.stringify(err.message);
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!definition || !tokenScopeConfig) return <div className="animate-pulse">Loading...</div>;

  // Group fields by their group, excluding per-site fields (they go in the Sites section)
  const groups: Record<string, FieldDef[]> = {};
  const perSiteFieldDefs = definition.fields.filter((f) => f.perSite);
  for (const field of definition.fields) {
    if (field.perSite) continue; // per-site fields managed in Sites section
    if (field.dependsOn) {
      const depValue = config[field.dependsOn.field];
      const allowed = Array.isArray(field.dependsOn.value)
        ? field.dependsOn.value.includes(depValue)
        : field.dependsOn.value === depValue;
      if (!allowed) continue;
    }
    if (!groups[field.group]) groups[field.group] = [];
    groups[field.group].push(field);
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/dashboard/applications" className="hover:text-gray-700">
          Applications
        </Link>
        <span>/</span>
        <Link href={`/dashboard/applications/${appId}`} className="hover:text-gray-700">
          App
        </Link>
        <span>/</span>
        <span className="text-gray-900 capitalize">{definition.label}</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">
          {existingAccess ? 'Edit' : 'Configure'} {definition.label}
        </h1>
        <DeploymentEnvBadge />
      </div>

      {/* SMART Integration URLs — register these in your EHR developer portal */}
      {existingAccess && (config.appType === 'provider-ehr' || config.appType === 'provider-standalone') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 space-y-3">
          <h3 className="text-sm font-semibold text-blue-800">SMART on FHIR Integration URLs</h3>
          <p className="text-xs text-blue-600">Register these URLs in your EHR developer portal:</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-500 w-24 shrink-0">Launch URL:</span>
              <code className="text-xs bg-blue-100 px-2 py-1 rounded text-blue-900 select-all flex-1 break-all">
                {`${process.env.NEXT_PUBLIC_BRIDGE_API_URL || 'http://localhost:3000/api'}/v1/smart/launch/${appId}/${ehrName}`}
              </code>
              <CopyButton
                text={`${process.env.NEXT_PUBLIC_BRIDGE_API_URL || 'http://localhost:3000/api'}/v1/smart/launch/${appId}/${ehrName}`}
                className="text-blue-400 hover:text-blue-600 p-0.5 hover:bg-blue-100 rounded transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-500 w-24 shrink-0">Redirect URI:</span>
              <code className="text-xs bg-blue-100 px-2 py-1 rounded text-blue-900 select-all flex-1 break-all">
                {`${process.env.NEXT_PUBLIC_BRIDGE_API_URL || 'http://localhost:3000/api'}/v1/smart/callback/${appId}/${ehrName}`}
              </code>
              <CopyButton
                text={`${process.env.NEXT_PUBLIC_BRIDGE_API_URL || 'http://localhost:3000/api'}/v1/smart/callback/${appId}/${ehrName}`}
                className="text-blue-400 hover:text-blue-600 p-0.5 hover:bg-blue-100 rounded transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-500 w-24 shrink-0">App ID:</span>
              <code className="text-xs bg-blue-100 px-2 py-1 rounded text-blue-900 select-all">{appId}</code>
              <CopyButton
                text={appId}
                className="text-blue-400 hover:text-blue-600 p-0.5 hover:bg-blue-100 rounded transition-colors"
              />
            </div>
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-4">{error}</div>}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Dynamic Config Fields (grouped) */}
        {Object.entries(groups).map(([groupName, fields]) => (
          <div key={groupName} className="bg-white rounded-lg shadow p-6">
            <h3 className="text-md font-semibold mb-4 capitalize">{groupName}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map((field) => {
                const hasDefault = field.defaultValue !== undefined;
                const currentValue = config[field.key] ?? '';
                const isUsingDefault = hasDefault && currentValue === field.defaultValue;
                const isAppTypeField = field.key === 'appType';

                return (
                  <div key={field.key} className={field.type === 'json' || field.type === 'jwk' ? 'md:col-span-2' : ''}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                      {isUsingDefault && <span className="text-xs text-blue-500 ml-2 font-normal">(default)</span>}
                    </label>

                    {field.type === 'jwk' ? (
                      <div className="space-y-3">
                        {/* JWK Status */}
                        <div
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                            jwkStatus[field.key]?.configured
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              jwkStatus[field.key]?.configured ? 'bg-green-500' : 'bg-yellow-500'
                            }`}
                          />
                          {jwkStatus[field.key]?.configured ? (
                            <span>
                              Key configured — {jwkStatus[field.key].keyType}/{jwkStatus[field.key].algorithm}
                              {jwkStatus[field.key].keyId && ` (kid: ${jwkStatus[field.key].keyId})`}
                            </span>
                          ) : (
                            <span>No private key configured</span>
                          )}
                        </div>

                        {/* Upload via file */}
                        <div className="flex gap-2">
                          <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm">
                            {jwkUploading[field.key] ? 'Uploading...' : 'Upload JWK File'}
                            <input
                              type="file"
                              accept=".json,.jwk,.pem"
                              className="hidden"
                              disabled={jwkUploading[field.key]}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const text = await file.text();
                                handleJwkUpload(field.key, text);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          {jwkStatus[field.key]?.configured && (
                            <button
                              type="button"
                              onClick={() => handleJwkDelete(field.key)}
                              className="bg-red-100 text-red-600 px-4 py-2 rounded-md hover:bg-red-200 text-sm"
                            >
                              Delete Key
                            </button>
                          )}
                        </div>

                        {/* Paste option */}
                        <details className="text-sm">
                          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                            Or paste JWKS JSON
                          </summary>
                          <div className="mt-2">
                            <textarea
                              rows={6}
                              className="w-full border rounded-md px-3 py-2 text-sm font-mono"
                              placeholder='{"keys": [{"kty": "RSA", "d": "...", "n": "...", ...}]}'
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                  handleJwkUpload(field.key, (e.target as HTMLTextAreaElement).value);
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="mt-1 text-xs text-blue-600 hover:underline"
                              onClick={(e) => {
                                const textarea = (e.target as HTMLElement)
                                  .previousElementSibling as HTMLTextAreaElement;
                                if (textarea?.value) handleJwkUpload(field.key, textarea.value);
                              }}
                            >
                              Upload pasted JWKS
                            </button>
                          </div>
                        </details>
                      </div>
                    ) : field.type === 'boolean' ? (
                      <select
                        value={config[field.key] ?? ''}
                        onChange={(e) => updateConfig(field.key, e.target.value === 'true')}
                        className="w-full border rounded-md px-3 py-2 text-sm"
                      >
                        <option value="">-- Select --</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : field.type === 'select' && field.options ? (
                      <>
                        <select
                          value={config[field.key] ?? ''}
                          onChange={(e) => {
                            if (isAppTypeField) {
                              handleAppTypeChange(e.target.value);
                            } else {
                              updateConfig(field.key, e.target.value);
                            }
                          }}
                          disabled={isAppTypeField && (!!existingAccess || !!urlAppType)}
                          className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                          required={field.required}
                        >
                          <option value="">-- Select --</option>
                          {field.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {isAppTypeField && (!!existingAccess || !!urlAppType) && (
                          <p className="text-xs text-gray-500 mt-1">
                            App type cannot be changed once integrated. Create a new integration to use a different
                            launch mode.
                          </p>
                        )}
                      </>
                    ) : field.type === 'json' ? (
                      <textarea
                        value={
                          typeof config[field.key] === 'object'
                            ? JSON.stringify(config[field.key], null, 2)
                            : (config[field.key] ?? '')
                        }
                        onChange={(e) => {
                          try {
                            updateConfig(field.key, JSON.parse(e.target.value));
                          } catch {
                            updateConfig(field.key, e.target.value);
                          }
                        }}
                        rows={4}
                        className="w-full border rounded-md px-3 py-2 text-sm font-mono"
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <div className="relative">
                        <input
                          type={
                            field.type === 'password' && !showPassword[field.key]
                              ? 'password'
                              : field.type === 'url'
                                ? 'url'
                                : 'text'
                          }
                          value={config[field.key] ?? ''}
                          onChange={(e) => updateConfig(field.key, e.target.value)}
                          className={`w-full border rounded-md px-3 py-2 text-sm ${
                            isUsingDefault ? 'border-blue-200 bg-blue-50/30' : ''
                          } ${field.type === 'password' ? 'pr-10' : ''}`}
                          placeholder={field.placeholder}
                          required={field.required}
                        />
                        {field.type === 'password' && (
                          <PasswordToggle
                            visible={!!showPassword[field.key]}
                            onToggle={() => setShowPassword((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                          />
                        )}
                        {hasDefault && !isUsingDefault && currentValue !== '' && field.type !== 'password' && (
                          <button
                            type="button"
                            onClick={() => resetToDefault(field.key)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-500 hover:text-blue-700"
                            title={`Reset to default: ${field.defaultValue}`}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    )}

                    {field.description && <p className="text-xs text-gray-400 mt-1">{field.description}</p>}
                    {hasDefault && (
                      <p className="text-xs text-blue-400 mt-0.5">
                        Default: <code className="bg-gray-100 px-1 rounded text-xs">{String(field.defaultValue)}</code>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* EHR Token Scopes */}
        {tokenScopeConfig.options.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-md font-semibold">EHR Token Scopes</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Scopes requested from the EHR&apos;s OAuth token endpoint
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllEhrTokenScopes}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAllEhrTokenScopes}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {tokenScopeConfig.options.map((opt) => (
                <label key={opt.value} className="flex items-start gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selectedEhrTokenScopes.includes(opt.value)}
                    onChange={() => toggleEhrTokenScope(opt.value)}
                    className="rounded border-gray-300 mt-0.5"
                  />
                  <div>
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-gray-400 ml-2 font-mono text-xs">{opt.value}</span>
                    {opt.description && <p className="text-xs text-gray-400">{opt.description}</p>}
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">{selectedEhrTokenScopes.length} scope(s) selected</p>
          </div>
        )}

        {/* Sites/Practices Section (multi-site EHRs only) */}
        {isMultiSite && existingAccess && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-md font-semibold">Sites / Practices</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Each site has its own {perSiteFieldDefs.map((f) => f.label).join(', ')}
                </p>
              </div>
              <Button type="button" variant="primary" size="sm" onClick={() => setShowAddSite(!showAddSite)}>
                {showAddSite ? 'Cancel' : 'Add Site'}
              </Button>
            </div>

            {/* Add Site Form */}
            {showAddSite && (
              <div className="bg-gray-50 border rounded-lg p-4 mb-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
                  <input
                    type="text"
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    placeholder="e.g., Main Clinic, North Campus"
                  />
                </div>
                {perSiteFieldDefs.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      value={newSiteIdentifiers[field.key] || ''}
                      onChange={(e) => setNewSiteIdentifiers((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      placeholder={field.placeholder || field.description}
                    />
                    {field.description && <p className="text-xs text-gray-400 mt-1">{field.description}</p>}
                  </div>
                ))}
                <Button type="button" variant="success" size="sm" onClick={handleAddSite}>
                  Add Site
                </Button>
              </div>
            )}

            {/* Sites List */}
            {sites.length === 0 ? (
              <p className="text-gray-400 text-sm">No sites configured yet.</p>
            ) : (
              <div className="space-y-3">
                {sites.map((site) => (
                  <div key={site.id} className={`border rounded-lg p-4 ${!site.isActive ? 'opacity-50' : ''}`}>
                    {editingSiteId === site.id ? (
                      /* Edit Mode */
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
                          <input
                            type="text"
                            value={editSiteName}
                            onChange={(e) => setEditSiteName(e.target.value)}
                            className="w-full border rounded-md px-3 py-2 text-sm"
                          />
                        </div>
                        {perSiteFieldDefs.map((field) => (
                          <div key={field.key}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                            <input
                              type="text"
                              value={editSiteIdentifiers[field.key] || ''}
                              onChange={(e) =>
                                setEditSiteIdentifiers((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                              className="w-full border rounded-md px-3 py-2 text-sm"
                            />
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Button type="button" variant="success" size="sm" onClick={() => handleUpdateSite(site.id)}>
                            Save
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditingSiteId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{site.name}</p>
                              {site.isDefault && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Default</span>
                              )}
                              {!site.isApproved && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                                  Pending Approval
                                </span>
                              )}
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${site.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                              >
                                {site.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-gray-400">Site ID:</span>
                              <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 select-all">
                                {site.id}
                              </code>
                              <CopyButton text={site.id} />
                              <span className="text-xs text-gray-300 ml-1">
                                ( use as <code className="font-mono">SiteId</code> header )
                              </span>
                            </div>
                            {perSiteFieldDefs.map((field) => (
                              <p key={field.key} className="text-xs text-gray-500 mt-0.5">
                                <span className="text-gray-400">{field.label}:</span>{' '}
                                <code className="bg-gray-50 px-1 rounded">
                                  {(site.siteIdentifiers as any)?.[field.key] || '—'}
                                </code>
                              </p>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            {!site.isApproved && (
                              <>
                                <Button
                                  type="button"
                                  variant="warning"
                                  size="sm"
                                  onClick={() => handleApproveSite(site.id, site.name)}
                                >
                                  Approve
                                </Button>
                                <Button
                                  type="button"
                                  variant="danger"
                                  size="sm"
                                  confirmMessage={`Deny and permanently delete site "${site.name}"? This cannot be undone.`}
                                  onClick={() => handleDenySite(site.id, site.name)}
                                >
                                  Deny
                                </Button>
                              </>
                            )}
                            {site.isActive ? (
                              <>
                                {!site.isDefault && (
                                  <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    onClick={() => handleSetDefault(site.id)}
                                  >
                                    Set Default
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  onClick={() => {
                                    setEditingSiteId(site.id);
                                    setEditSiteName(site.name);
                                    setEditSiteIdentifiers((site.siteIdentifiers as Record<string, any>) || {});
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  confirmMessage={`Deactivate site "${site.name}"?`}
                                  onClick={() => handleDeactivateSite(site.id, site.name)}
                                >
                                  Deactivate
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="success"
                                size="sm"
                                onClick={() => handleActivateSite(site.id, site.name)}
                              >
                                Activate
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Provider Access Section */}
                        {site.isApproved && site.isActive && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => toggleProviders(site.id)}
                                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className={`w-3.5 h-3.5 transition-transform ${expandedProviders[site.id] ? 'rotate-90' : ''}`}
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Provider Access
                                {siteProviders[site.id] && (
                                  <span className="text-xs font-normal text-gray-400 normal-case tracking-normal">
                                    ({siteProviders[site.id].length})
                                  </span>
                                )}
                              </button>
                              {expandedProviders[site.id] && siteProviders[site.id] && (
                                <button
                                  type="button"
                                  onClick={() => loadProviders(site.id)}
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  Refresh
                                </button>
                              )}
                            </div>

                            {expandedProviders[site.id] && (
                              <div className="mt-2 space-y-2">
                                {loadingProviders[site.id] ? (
                                  <p className="text-xs text-gray-400 italic">Loading providers...</p>
                                ) : !siteProviders[site.id] || siteProviders[site.id].length === 0 ? (
                                  <p className="text-xs text-gray-400 italic">No providers registered for this site</p>
                                ) : (
                                  siteProviders[site.id].map((provider: any) => (
                                    <div
                                      key={provider.id}
                                      className="flex items-center justify-between bg-gray-50 rounded p-2"
                                    >
                                      <div>
                                        <p className="text-sm font-medium">
                                          {provider.providerName || provider.providerFhirId}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {provider.providerFhirId && (
                                            <span className="font-mono">FHIR: {provider.providerFhirId}</span>
                                          )}
                                          {provider.providerEmail && (
                                            <span>
                                              {provider.providerFhirId ? ' · ' : ''}
                                              {provider.providerEmail}
                                            </span>
                                          )}
                                          {provider.providerNpi && <span> · NPI: {provider.providerNpi}</span>}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {!provider.isApproved ? (
                                          <>
                                            <Button
                                              type="button"
                                              variant="success"
                                              size="sm"
                                              onClick={() => handleApproveProvider(site.id, provider.id)}
                                            >
                                              Approve
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="danger"
                                              size="sm"
                                              confirmMessage={`Deny this provider? "${provider.providerName || provider.providerFhirId}" will not be able to launch.`}
                                              onClick={() => handleDenyProvider(site.id, provider.id)}
                                            >
                                              Deny
                                            </Button>
                                          </>
                                        ) : (
                                          <>
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                              Approved
                                            </span>
                                            <Button
                                              type="button"
                                              variant="link"
                                              size="sm"
                                              className="text-red-500 hover:text-red-700"
                                              confirmMessage={`Remove provider "${provider.providerName || provider.providerFhirId}" access?`}
                                              onClick={() => handleDenyProvider(site.id, provider.id)}
                                            >
                                              Remove
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <Button type="submit" variant="primary" loading={loading} loadingText="Saving...">
            {existingAccess ? 'Update Configuration' : 'Save Configuration'}
          </Button>
          <Link
            href={`/dashboard/applications/${appId}`}
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-300"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
