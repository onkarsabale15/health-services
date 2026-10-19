'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  applicationControllerRotateSecret,
  applicationControllerDeleteApplication,
  applicationControllerEnableApplication,
  applicationControllerUpdateApplication,
  applicationControllerUpdateJwks,
  applicationControllerRefreshJwks,
  applicationControllerRemoveJwks,
  ehrConfigControllerRemoveEhrAccess,
  ehrConfigControllerEnableEhrAccess,
  userControllerGrantAppAccess,
  userControllerRevokeAppAccess,
} from '@/lib/sdk/generated';
import { getAppTypeDefinition } from '@hs/config';
import { AuthUser } from '@/lib/auth';
import { CopyButton } from '@/components/copy-button';
import { Button } from '@/components/button';
import { getEffectiveAppType } from '@/lib/ehr-access';
import EhrAccessRow from './EhrAccessRow';
import AddEhrDropdown from './AddEhrDropdown';

const GRANT_TYPE_LABELS: Record<string, string> = {
  client_credentials: 'Client Credentials',
  'urn:ietf:params:oauth:grant-type:jwt-bearer': 'JWT Bearer Assertion',
};

interface EhrIntegrationsTabProps {
  app: any;
  setApp: (fn: (prev: any) => any) => void;
  appId: string;
  ehrAccess: any[];
  setEhrAccess: (fn: (prev: any[]) => any[]) => void;
  ehrDefs: any[];
  scopeInfo: { scopes: string[]; capabilities: Record<string, { read: boolean; write: boolean }> } | null;
  userAccess: any[];
  setUserAccess: (fn: (prev: any[]) => any[]) => void;
  orgUsers: any[];
  isReadonly: boolean;
  currentUser: AuthUser | null;
  toast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  isSingleEhr?: boolean;
}

export default function EhrIntegrationsTab({
  app,
  setApp,
  appId,
  ehrAccess,
  setEhrAccess,
  ehrDefs,
  scopeInfo,
  userAccess,
  setUserAccess,
  orgUsers,
  isReadonly,
  currentUser,
  toast,
  isSingleEhr,
}: EhrIntegrationsTabProps) {
  const router = useRouter();

  // Client secret
  const [showSecret, setShowSecret] = useState<string | null>(null);

  // JWKS management
  const [showJwksEditor, setShowJwksEditor] = useState(false);
  const [jwksUri, setJwksUri] = useState('');
  const [jwksUriValid, setJwksUriValid] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [jwksUriError, setJwksUriError] = useState('');
  const [jwksKeysSummary, setJwksKeysSummary] = useState('');
  const jwksDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [jwksError, setJwksError] = useState('');
  const [jwksSaving, setJwksSaving] = useState(false);
  const [jwksRefreshing, setJwksRefreshing] = useState(false);

  // Settings editing
  const [editSettings, setEditSettings] = useState(false);
  const [editName, setEditName] = useState(app.name || '');
  const [editGrantTypes, setEditGrantTypes] = useState<string[]>(app.allowedGrantTypes || []);
  const [editScopes, setEditScopes] = useState<string[]>(app.scopes || []);
  const [editTokenLifetime, setEditTokenLifetime] = useState(app.tokenLifetime || 3600);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // User access management
  const [showGrantAccess, setShowGrantAccess] = useState(false);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantLevel, setGrantLevel] = useState<'READONLY' | 'FULL'>('READONLY');

  // Derived
  const hasSecret = app.allowedGrantTypes?.includes('client_credentials');
  const hasJwtBearer = app.allowedGrantTypes?.includes('urn:ietf:params:oauth:grant-type:jwt-bearer');
  const hasJwks = app.jwks?.keys?.length > 0;

  // --- Handlers ---

  async function handleRotateSecret() {
    try {
      const { data, error: rotateErr } = await applicationControllerRotateSecret({ path: { id: appId } });
      if (rotateErr || !data) throw new Error((rotateErr as any)?.message || 'Failed to rotate secret');
      setShowSecret((data as any).clientSecret);
      toast('Client secret rotated', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to rotate secret', 'error');
    }
  }

  async function handleDisable() {
    try {
      const { error: delErr } = await applicationControllerDeleteApplication({ path: { id: appId } });
      if (delErr) throw new Error((delErr as any)?.message || 'Failed to disable application');
      toast('Application disabled', 'success');
      setApp((prev: any) => (prev ? { ...prev, status: 'DISABLED' } : prev));
    } catch (err: any) {
      toast(err.message || 'Failed to disable application', 'error');
    }
  }

  async function handleEnable() {
    try {
      const { error: enableErr } = await applicationControllerEnableApplication({ path: { id: appId } });
      if (enableErr) throw new Error((enableErr as any)?.message || 'Failed to enable application');
      toast('Application enabled', 'success');
      setApp((prev: any) => (prev ? { ...prev, status: 'ACTIVE' } : prev));
    } catch (err: any) {
      toast(err.message || 'Failed to enable application', 'error');
    }
  }

  async function handleRemoveEhr(ehrName: string, ehrAppType: string) {
    try {
      const { error: rmErr } = await ehrConfigControllerRemoveEhrAccess({
        path: { appId, ehrName },
        query: { appType: ehrAppType } as any,
      });
      if (rmErr) throw new Error((rmErr as any)?.message || 'Failed to disable EHR');
      toast(`${ehrName} access disabled`, 'success');
      setEhrAccess((prev) =>
        prev.map((e) =>
          e.ehrName === ehrName && getEffectiveAppType(e) === ehrAppType ? { ...e, status: 'DISABLED' } : e,
        ),
      );
    } catch (err: any) {
      toast(err.message || 'Failed to disable EHR', 'error');
    }
  }

  async function handleEnableEhr(ehrName: string, ehrAppType: string) {
    try {
      const { error: enErr } = await ehrConfigControllerEnableEhrAccess({
        path: { appId, ehrName },
        query: { appType: ehrAppType } as any,
      });
      if (enErr) throw new Error((enErr as any)?.message || 'Failed to enable EHR');
      toast(`${ehrName} access enabled`, 'success');
      setEhrAccess((prev) =>
        prev.map((e) =>
          e.ehrName === ehrName && getEffectiveAppType(e) === ehrAppType ? { ...e, status: 'ACTIVE' } : e,
        ),
      );
    } catch (err: any) {
      toast(err.message || 'Failed to enable EHR', 'error');
    }
  }

  async function handleGrantAccess() {
    if (!grantUserId) return;
    try {
      const { data: result, error: grantErr } = await userControllerGrantAppAccess({
        path: { userId: grantUserId, appId },
        body: { accessLevel: grantLevel },
      } as any);
      if (grantErr) throw new Error((grantErr as any)?.message || 'Failed to grant access');
      setShowGrantAccess(false);
      const grantedUser = orgUsers.find((u: any) => u.id === grantUserId);
      if (grantedUser) {
        setUserAccess((prev) => [
          { ...(result as any), userId: grantUserId, user: grantedUser, accessLevel: grantLevel },
          ...prev,
        ]);
      }
      setGrantUserId('');
      setGrantLevel('READONLY');
      toast('Access granted', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to grant access', 'error');
    }
  }

  async function handleChangeAccessLevel(userId: string, newLevel: 'READONLY' | 'FULL') {
    try {
      const { error: changeErr } = await userControllerGrantAppAccess({
        path: { userId, appId },
        body: { accessLevel: newLevel },
      } as any);
      if (changeErr) throw new Error((changeErr as any)?.message || 'Failed to update access level');
      toast('Access level updated', 'success');
      setUserAccess((prev) => prev.map((a) => (a.userId === userId ? { ...a, accessLevel: newLevel } : a)));
    } catch (err: any) {
      toast(err.message || 'Failed to update access level', 'error');
    }
  }

  async function handleRevokeAccess(userId: string, userName: string) {
    try {
      const { error: revokeErr } = await userControllerRevokeAppAccess({ path: { userId, appId } });
      if (revokeErr) throw new Error((revokeErr as any)?.message || 'Failed to revoke access');
      toast('Access revoked', 'success');
      setUserAccess((prev) => prev.filter((a) => a.userId !== userId));
    } catch (err: any) {
      toast(err.message || 'Failed to revoke access', 'error');
    }
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

  async function handleSaveJwks() {
    setJwksError('');
    if (!jwksUri.trim()) {
      setJwksError('JWKS URL is required');
      return;
    }
    try {
      const parsed = new URL(jwksUri.trim());
      if (parsed.protocol !== 'https:') {
        setJwksError('JWKS URL must use HTTPS');
        return;
      }
    } catch {
      setJwksError('Invalid URL format');
      return;
    }

    setJwksSaving(true);
    try {
      const { data: result, error: jwksSaveErr } = await applicationControllerUpdateJwks({
        path: { id: appId },
        body: { jwksUri: jwksUri.trim() },
      } as any);
      if (jwksSaveErr || !result) throw new Error((jwksSaveErr as any)?.message || 'Failed to save JWKS');
      setShowJwksEditor(false);
      setJwksUri('');
      toast('JWKS saved', 'success');
      setApp((prev: any) =>
        prev ? { ...prev, jwks: { uri: (result as any).uri, keys: (result as any).keys || [] } } : prev,
      );
    } catch (err: any) {
      setJwksError(err.message);
      toast(err.message || 'Failed to save JWKS', 'error');
    } finally {
      setJwksSaving(false);
    }
  }

  async function handleRefreshJwks() {
    setJwksRefreshing(true);
    try {
      const { data: result, error: refreshErr } = await applicationControllerRefreshJwks({ path: { id: appId } });
      if (refreshErr || !result) throw new Error((refreshErr as any)?.message || 'Failed to refresh JWKS');
      toast('JWKS refreshed', 'success');
      setApp((prev: any) => (prev ? { ...prev, jwks: { ...prev.jwks, uri: (result as any).uri } } : prev));
    } catch (err: any) {
      toast(err.message || 'Failed to refresh JWKS', 'error');
    } finally {
      setJwksRefreshing(false);
    }
  }

  async function handleRemoveJwks() {
    try {
      const { error: removeErr } = await applicationControllerRemoveJwks({ path: { id: appId } });
      if (removeErr) throw new Error((removeErr as any)?.message || 'Failed to remove JWKS');
      toast('JWKS removed', 'success');
      setApp((prev: any) => (prev ? { ...prev, jwks: {} } : prev));
    } catch (err: any) {
      toast(err.message || 'Failed to remove JWKS', 'error');
    }
  }

  async function handleSaveSettings() {
    if (editGrantTypes.length === 0) {
      toast('Auth method is required', 'warning');
      return;
    }
    setSettingsSaving(true);
    try {
      const { error: updateErr } = await applicationControllerUpdateApplication({
        path: { id: appId },
        body: {
          name: editName,
          allowedGrantTypes: editGrantTypes,
          scopes: editScopes,
          tokenLifetime: editTokenLifetime,
        } as any,
      });
      if (updateErr) throw new Error((updateErr as any)?.message || 'Failed to save settings');
      setEditSettings(false);
      toast('Settings saved', 'success');
      setApp((prev: any) =>
        prev
          ? {
              ...prev,
              name: editName,
              allowedGrantTypes: editGrantTypes,
              scopes: editScopes,
              tokenLifetime: editTokenLifetime,
            }
          : prev,
      );
    } catch (err: any) {
      toast(err.message || 'Failed to save settings', 'error');
    } finally {
      setSettingsSaving(false);
    }
  }

  const canAddEhr = !isReadonly && !(isSingleEhr && ehrAccess.length > 0);

  return (
    <div className="space-y-6">
      {isReadonly && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700 font-medium">Read-Only Access</p>
          <p className="text-xs text-yellow-600 mt-1">
            You have read-only access to this application. Contact an admin or owner to request full access.
          </p>
        </div>
      )}

      {/* App Details */}
      <AppDetailsSection
        app={app}
        isReadonly={isReadonly}
        editSettings={editSettings}
        setEditSettings={setEditSettings}
        editName={editName}
        setEditName={setEditName}
        editGrantTypes={editGrantTypes}
        setEditGrantTypes={setEditGrantTypes}
        editTokenLifetime={editTokenLifetime}
        setEditTokenLifetime={setEditTokenLifetime}
        editScopes={editScopes}
        setEditScopes={setEditScopes}
        scopeInfo={scopeInfo}
        settingsSaving={settingsSaving}
        handleSaveSettings={handleSaveSettings}
      />

      {/* Authentication Methods */}
      <AuthenticationSection
        app={app}
        isReadonly={isReadonly}
        hasSecret={hasSecret}
        hasJwtBearer={hasJwtBearer}
        hasJwks={hasJwks}
        showSecret={showSecret}
        handleRotateSecret={handleRotateSecret}
        showJwksEditor={showJwksEditor}
        setShowJwksEditor={setShowJwksEditor}
        jwksUri={jwksUri}
        jwksUriValid={jwksUriValid}
        jwksUriError={jwksUriError}
        jwksKeysSummary={jwksKeysSummary}
        jwksError={jwksError}
        jwksSaving={jwksSaving}
        jwksRefreshing={jwksRefreshing}
        handleJwksUriChange={handleJwksUriChange}
        handleSaveJwks={handleSaveJwks}
        handleRefreshJwks={handleRefreshJwks}
        handleRemoveJwks={handleRemoveJwks}
        jwksDebounceRef={jwksDebounceRef}
        setJwksUri={setJwksUri}
        setJwksUriValid={setJwksUriValid}
        setJwksUriError={setJwksUriError}
        setJwksKeysSummary={setJwksKeysSummary}
        setJwksError={setJwksError}
      />

      {/* JWKS Info Banner for provider/CDS apps */}
      {['CDS', 'BRIDGE', 'WORKFLOW'].includes(app.appType) && !hasJwks && app.smartLaunchUrl && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-blue-500 text-lg mt-0.5">&#9432;</span>
            <div>
              <p className="text-sm font-semibold text-blue-800">JWKS Required for SMART on FHIR Launch</p>
              <p className="text-xs text-blue-700 mt-1">
                Provider-launched applications (SMART on FHIR) require JWKS to securely receive encrypted launch tokens
                from the bridge. Without JWKS, the bridge cannot encrypt the patient/encounter context using asymmetric
                encryption.
              </p>
              <p className="text-xs text-blue-600 mt-2">
                Go to <strong>Authentication</strong> above and set a JWKS URL pointing to your app's public key
                endpoint. For platform-hosted apps, use the platform's{' '}
                <code className="bg-blue-100 px-1 rounded">/.well-known/jwks.json</code> endpoint.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Configured EHRs */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Configured EHRs</h2>
          {canAddEhr && (
            <AddEhrDropdown
              ehrDefs={ehrDefs}
              configuredAppTypes={configuredAppTypesByEhr(ehrAccess)}
              allowedAppTypes={getAppTypeDefinition(app.appType)?.allowedEhrAppTypes}
              onSelect={(ehrName, ehrAppType) =>
                router.push(`/dashboard/applications/${appId}/ehr/${ehrName}?appType=${ehrAppType}`)
              }
            />
          )}
        </div>
        {ehrAccess.length === 0 ? (
          <p className="text-gray-400 text-sm">
            {isReadonly ? 'No EHRs configured.' : 'No EHRs configured yet. Click "+ Add EHR" to add one.'}
          </p>
        ) : (
          <div className="space-y-3">
            {ehrAccess.map((access: any) => (
              <EhrAccessRow
                key={`${access.ehrName}:${getEffectiveAppType(access)}`}
                access={access}
                appId={appId}
                isReadonly={isReadonly}
                onRemove={handleRemoveEhr}
                onEnable={handleEnableEhr}
              />
            ))}
          </div>
        )}
      </div>

      {/* User Access */}
      {!isReadonly && (
        <UserAccessSection
          appId={appId}
          userAccess={userAccess}
          orgUsers={orgUsers}
          currentUser={currentUser}
          showGrantAccess={showGrantAccess}
          setShowGrantAccess={setShowGrantAccess}
          grantUserId={grantUserId}
          setGrantUserId={setGrantUserId}
          grantLevel={grantLevel}
          setGrantLevel={setGrantLevel}
          handleGrantAccess={handleGrantAccess}
          handleChangeAccessLevel={handleChangeAccessLevel}
          handleRevokeAccess={handleRevokeAccess}
        />
      )}

      {/* Danger Zone */}
      {!isReadonly && (
        <div
          className={`bg-white rounded-lg shadow p-6 border ${app.status === 'ACTIVE' ? 'border-red-100' : 'border-yellow-200'}`}
        >
          <h2 className={`text-lg font-semibold mb-3 ${app.status === 'ACTIVE' ? 'text-red-700' : 'text-yellow-700'}`}>
            {app.status === 'ACTIVE' ? 'Danger Zone' : 'Application Disabled'}
          </h2>
          {app.status === 'ACTIVE' ? (
            <>
              <p className="text-sm text-gray-500 mb-3">
                Disabling this application will immediately revoke all access.
              </p>
              <Button
                variant="danger"
                size="sm"
                confirmMessage="Disable this application? All access will be revoked immediately."
                onClick={handleDisable}
              >
                Disable Application
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-3">
                This application is currently disabled. Re-enable it to restore access.
              </p>
              <Button variant="success" size="sm" confirmMessage="Re-enable this application?" onClick={handleEnable}>
                Enable Application
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// --- Helpers ---

/**
 * Group the app types already configured per EHR — drives the "Configured"
 * markers in the Add-EHR dropdown so each (ehrName, launch-mode) is offered
 * at most once.
 */
function configuredAppTypesByEhr(ehrAccess: any[]): Record<string, string[]> {
  const byEhr: Record<string, string[]> = {};
  for (const access of ehrAccess) {
    const list = (byEhr[access.ehrName] ??= []);
    const appType = getEffectiveAppType(access);
    if (!list.includes(appType)) list.push(appType);
  }
  return byEhr;
}

// --- Sub-sections extracted as local components to keep the main component readable ---

function AppDetailsSection({
  app,
  isReadonly,
  editSettings,
  setEditSettings,
  editName,
  setEditName,
  editGrantTypes,
  setEditGrantTypes,
  editTokenLifetime,
  setEditTokenLifetime,
  editScopes,
  setEditScopes,
  scopeInfo,
  settingsSaving,
  handleSaveSettings,
}: {
  app: any;
  isReadonly: boolean;
  editSettings: boolean;
  setEditSettings: (v: boolean) => void;
  editName: string;
  setEditName: (v: string) => void;
  editGrantTypes: string[];
  setEditGrantTypes: (gts: string[]) => void;
  editTokenLifetime: number;
  setEditTokenLifetime: (v: number) => void;
  editScopes: string[];
  setEditScopes: (fn: string[] | ((prev: string[]) => string[])) => void;
  scopeInfo: { scopes: string[]; capabilities: Record<string, { read: boolean; write: boolean }> } | null;
  settingsSaving: boolean;
  handleSaveSettings: () => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-lg font-semibold">Application Details</h2>
        {!isReadonly && (
          <button onClick={() => setEditSettings(!editSettings)} className="text-sm text-blue-600 hover:underline">
            {editSettings ? 'Cancel' : 'Edit'}
          </button>
        )}
      </div>

      {editSettings && !isReadonly ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Auth Method</label>
            {Object.entries(GRANT_TYPE_LABELS).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                  type="radio"
                  name={`grantType-${app.id}`}
                  checked={editGrantTypes.includes(value)}
                  onChange={() => setEditGrantTypes([value])}
                  className="border-gray-300"
                />
                <span className="text-sm">{label}</span>
                <span className="text-xs text-gray-400">
                  {value === 'client_credentials' ? '(client_id + secret)' : '(signed JWT + JWKS)'}
                </span>
              </label>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Token Lifetime (seconds)</label>
            <input
              type="number"
              min={60}
              max={86400}
              value={editTokenLifetime}
              onChange={(e) => setEditTokenLifetime(Number(e.target.value))}
              className="w-48 border rounded-md px-3 py-2"
            />
          </div>

          {scopeInfo && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">FHIR Platform Scopes</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditScopes([...scopeInfo.scopes])}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditScopes([])}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-2">
                Controls which FHIR resources this app can access through the FHIR bridge
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto border rounded-md p-3">
                {Object.entries(scopeInfo.capabilities).map(([resource, caps]) => (
                  <div key={resource} className="flex items-center gap-3 text-sm">
                    <span className="w-40 font-medium">{resource}</span>
                    {caps.read && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editScopes.includes(`FHIR.R4/${resource}.read`)}
                          onChange={() =>
                            setEditScopes((prev: string[]) =>
                              prev.includes(`FHIR.R4/${resource}.read`)
                                ? prev.filter((s) => s !== `FHIR.R4/${resource}.read`)
                                : [...prev, `FHIR.R4/${resource}.read`],
                            )
                          }
                          className="rounded border-gray-300"
                        />
                        <span className="text-gray-600">Read</span>
                      </label>
                    )}
                    {caps.write && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editScopes.includes(`FHIR.R4/${resource}.write`)}
                          onChange={() =>
                            setEditScopes((prev: string[]) =>
                              prev.includes(`FHIR.R4/${resource}.write`)
                                ? prev.filter((s) => s !== `FHIR.R4/${resource}.write`)
                                : [...prev, `FHIR.R4/${resource}.write`],
                            )
                          }
                          className="rounded border-gray-300"
                        />
                        <span className="text-gray-600">Write</span>
                      </label>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">{editScopes.length} scope(s) selected</p>
            </div>
          )}

          <Button
            variant="primary"
            size="sm"
            loading={settingsSaving}
            loadingText="Saving..."
            onClick={handleSaveSettings}
          >
            Save Settings
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Name</p>
            <p className="font-medium">{app.name}</p>
          </div>
          <div>
            <p className="text-gray-500">Client ID</p>
            <div className="flex items-center gap-1">
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">{app.clientId}</code>
              <CopyButton text={app.clientId} />
            </div>
          </div>
          <div>
            <p className="text-gray-500">Grant Types</p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {app.allowedGrantTypes?.map((gt: string) => (
                <span key={gt} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                  {GRANT_TYPE_LABELS[gt] || gt}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-gray-500">Token Lifetime</p>
            <p>{app.tokenLifetime}s</p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-500">FHIR Platform Scopes</p>
            {app.scopes?.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {app.scopes.map((s: string) => (
                  <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No scopes configured</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AuthenticationSection({
  app,
  isReadonly,
  hasSecret,
  hasJwtBearer,
  hasJwks,
  showSecret,
  handleRotateSecret,
  showJwksEditor,
  setShowJwksEditor,
  jwksUri,
  jwksUriValid,
  jwksUriError,
  jwksKeysSummary,
  jwksError,
  jwksSaving,
  jwksRefreshing,
  handleJwksUriChange,
  handleSaveJwks,
  handleRefreshJwks,
  handleRemoveJwks,
  jwksDebounceRef,
  setJwksUri,
  setJwksUriValid,
  setJwksUriError,
  setJwksKeysSummary,
  setJwksError,
}: {
  app: any;
  isReadonly: boolean;
  hasSecret: boolean;
  hasJwtBearer: boolean;
  hasJwks: boolean;
  showSecret: string | null;
  handleRotateSecret: () => void;
  showJwksEditor: boolean;
  setShowJwksEditor: (v: boolean) => void;
  jwksUri: string;
  jwksUriValid: string;
  jwksUriError: string;
  jwksKeysSummary: string;
  jwksError: string;
  jwksSaving: boolean;
  jwksRefreshing: boolean;
  handleJwksUriChange: (v: string) => void;
  handleSaveJwks: () => void;
  handleRefreshJwks: () => void;
  handleRemoveJwks: () => void;
  jwksDebounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  setJwksUri: (v: string) => void;
  setJwksUriValid: (v: 'idle' | 'checking' | 'valid' | 'invalid') => void;
  setJwksUriError: (v: string) => void;
  setJwksKeysSummary: (v: string) => void;
  setJwksError: (v: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Authentication</h2>

      <div className="space-y-4">
        {/* Client Secret Section */}
        <div className={`border rounded-lg p-4 ${hasSecret ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Client Secret</h3>
                {hasSecret && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Active</span>}
                {!hasSecret && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Disabled</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Authenticate using client_id and client_secret in the token request
              </p>
            </div>
            {hasSecret && !isReadonly && (
              <Button
                variant="warning"
                size="sm"
                confirmMessage="Rotate client secret? The old secret will stop working immediately."
                onClick={handleRotateSecret}
              >
                Rotate Secret
              </Button>
            )}
          </div>
          {showSecret && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-sm font-medium text-yellow-800">New Client Secret:</p>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded block mt-1 break-all">{showSecret}</code>
              <p className="text-xs text-red-600 mt-1">Save this now. It will not be shown again.</p>
            </div>
          )}
        </div>

        {/* JWKS Section */}
        <div className={`border rounded-lg p-4 ${hasJwtBearer ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">JWKS (Public Key)</h3>
                {hasJwtBearer && hasJwks && (
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Configured</span>
                )}
                {hasJwtBearer && !hasJwks && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">No keys uploaded</span>
                )}
                {!hasJwtBearer && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Disabled</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Authenticate by signing a JWT with your private key (RFC 7523 JWT Bearer)
              </p>
            </div>
            {!isReadonly && (
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setShowJwksEditor(!showJwksEditor);
                    setJwksError('');
                    handleJwksUriChange(app.jwks?.uri || '');
                  }}
                >
                  {hasJwks ? 'Update JWKS URL' : 'Set JWKS URL'}
                </Button>
                {hasJwks && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={jwksRefreshing}
                      loadingText="Refreshing..."
                      onClick={handleRefreshJwks}
                    >
                      Refresh Keys
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      confirmMessage="Remove JWKS? JWT Bearer authentication will stop working."
                      onClick={handleRemoveJwks}
                    >
                      Remove
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Current JWKS info */}
          {hasJwks && !showJwksEditor && (
            <div className="mt-3 text-xs space-y-2">
              {app.jwks.uri && (
                <div className="bg-gray-50 border rounded px-3 py-2">
                  <span className="text-gray-500">URL:</span>{' '}
                  <code className="text-gray-700 break-all">{app.jwks.uri}</code>
                </div>
              )}
              <p className="text-gray-500">{app.jwks.keys.length} key(s) fetched</p>
              {app.jwks.keys.map((key: any, i: number) => (
                <div key={i} className="bg-white border rounded px-3 py-2">
                  <span className="font-medium">Key {i + 1}:</span>{' '}
                  <span className="text-gray-600">
                    {key.kty} / {key.alg || 'unspecified'} / kid: {key.kid || 'none'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* JWKS URL Editor */}
          {showJwksEditor && !isReadonly && (
            <div className="mt-3 space-y-2">
              {jwksError && <div className="bg-red-50 text-red-600 p-2 rounded text-sm">{jwksError}</div>}
              <div className="relative">
                <input
                  type="url"
                  value={jwksUri}
                  onChange={(e) => handleJwksUriChange(e.target.value)}
                  className={`w-full border rounded-md px-3 py-2 pr-10 text-sm ${
                    jwksUriValid === 'valid' ? 'border-green-400' : jwksUriValid === 'invalid' ? 'border-red-400' : ''
                  }`}
                  placeholder="https://your-domain.com/.well-known/jwks.json"
                />
                {jwksUriValid === 'checking' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm animate-spin">
                    &#9696;
                  </span>
                )}
                {jwksUriValid === 'valid' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-lg">&#10003;</span>
                )}
                {jwksUriValid === 'invalid' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-lg">&#10007;</span>
                )}
              </div>
              {jwksUriValid === 'invalid' && <p className="text-xs text-red-500">{jwksUriError}</p>}
              {jwksUriValid === 'valid' && jwksKeysSummary && (
                <p className="text-xs text-green-600">{jwksKeysSummary}</p>
              )}
              <p className="text-xs text-gray-400">
                Enter the HTTPS URL where your public JWKS is hosted. Validated after you stop typing.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="success"
                  size="sm"
                  loading={jwksSaving}
                  loadingText="Saving..."
                  onClick={handleSaveJwks}
                >
                  Fetch & Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowJwksEditor(false);
                    setJwksUri('');
                    setJwksUriValid('idle');
                    setJwksUriError('');
                    setJwksKeysSummary('');
                    if (jwksDebounceRef.current) clearTimeout(jwksDebounceRef.current);
                    setJwksError('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Warning if JWT Bearer enabled but no JWKS */}
          {hasJwtBearer && !hasJwks && !showJwksEditor && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-2">
              <p className="text-xs text-yellow-700">
                JWT Bearer grant type is enabled but no JWKS URL is configured. Set a JWKS URL to use this auth method.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserAccessSection({
  appId,
  userAccess,
  orgUsers,
  currentUser,
  showGrantAccess,
  setShowGrantAccess,
  grantUserId,
  setGrantUserId,
  grantLevel,
  setGrantLevel,
  handleGrantAccess,
  handleChangeAccessLevel,
  handleRevokeAccess,
}: {
  appId: string;
  userAccess: any[];
  orgUsers: any[];
  currentUser: AuthUser | null;
  showGrantAccess: boolean;
  setShowGrantAccess: (v: boolean) => void;
  grantUserId: string;
  setGrantUserId: (v: string) => void;
  grantLevel: 'READONLY' | 'FULL';
  setGrantLevel: (v: 'READONLY' | 'FULL') => void;
  handleGrantAccess: () => void;
  handleChangeAccessLevel: (userId: string, level: 'READONLY' | 'FULL') => void;
  handleRevokeAccess: (userId: string, userName: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">User Access</h2>
        <Button
          variant={showGrantAccess ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => setShowGrantAccess(!showGrantAccess)}
        >
          {showGrantAccess ? 'Cancel' : 'Grant Access'}
        </Button>
      </div>

      {showGrantAccess && (
        <div className="bg-gray-50 border rounded-lg p-4 mb-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
            <select
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select a user...</option>
              {orgUsers
                .filter(
                  (u: any) =>
                    u.status === 'ACTIVE' &&
                    u.id !== currentUser?.userId &&
                    !userAccess.some((a: any) => a.userId === u.id),
                )
                .map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.email})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access Level</label>
            <div className="flex gap-3">
              {(['READONLY', 'FULL'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setGrantLevel(level)}
                  className={`border rounded-lg px-4 py-2 text-sm transition-colors ${
                    grantLevel === level
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium">{level === 'READONLY' ? 'Read Only' : 'Full Access'}</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {level === 'READONLY' ? 'Can view app details only' : 'Can view and modify app settings'}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <Button variant="success" size="sm" disabled={!grantUserId} onClick={handleGrantAccess}>
            Grant Access
          </Button>
        </div>
      )}

      {userAccess.length === 0 ? (
        <p className="text-gray-400 text-sm">No users have been granted access to this application.</p>
      ) : (
        <div className="space-y-3">
          {userAccess.map((access: any) => {
            const isSelf = access.userId === currentUser?.userId;
            const isTargetOwner = access.user.role === 'OWNER';
            const canModify = !isSelf && (!isTargetOwner || currentUser?.role === 'OWNER');

            return (
              <div key={access.id} className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <p className="font-medium text-sm">
                    {access.user.firstName} {access.user.lastName}
                    {isSelf && <span className="text-xs text-gray-400 ml-2">(you)</span>}
                  </p>
                  <p className="text-xs text-gray-500">{access.user.email}</p>
                  <span className="text-xs text-gray-400 capitalize">{access.user.role.toLowerCase()}</span>
                </div>
                <div className="flex items-center gap-3">
                  {canModify ? (
                    <>
                      <select
                        value={access.accessLevel}
                        onChange={(e) => handleChangeAccessLevel(access.userId, e.target.value as 'READONLY' | 'FULL')}
                        className="border rounded-md px-2 py-1 text-sm"
                      >
                        <option value="READONLY">Read Only</option>
                        <option value="FULL">Full Access</option>
                      </select>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        confirmMessage={`Revoke access for ${access.user.firstName} ${access.user.lastName}?`}
                        onClick={() =>
                          handleRevokeAccess(access.userId, `${access.user.firstName} ${access.user.lastName}`)
                        }
                      >
                        Revoke
                      </Button>
                    </>
                  ) : (
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${access.accessLevel === 'FULL' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {access.accessLevel === 'FULL' ? 'Full Access' : 'Read Only'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
