'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  endUserControllerDetail,
  endUserControllerGrantApp,
  endUserControllerRevokeApp,
  endUserControllerBindExternalIdentity,
  endUserControllerUnbindExternalIdentity,
  applicationControllerListApplications,
} from '@/lib/sdk/generated';
import type { ApplicationDto, EndUserDetailDto } from '@/lib/sdk/generated';
import { getUser } from '@/lib/auth';
import { useToast } from '@/components/toast';
import { Button } from '@/components/button';

type Tab = 'profile' | 'apps' | 'sites' | 'identities';

export default function EndUserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { toast } = useToast();
  const currentUser = getUser();
  const canManage = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  const [user, setUser] = useState<EndUserDetailDto | null>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [apps, setApps] = useState<ApplicationDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void load();
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: detail, error }, { data: appList }] = await Promise.all([
        endUserControllerDetail({ path: { id: id as string } }),
        applicationControllerListApplications(),
      ]);
      if (error) throw new Error((error as { message?: string })?.message || 'Failed to load end-user');
      setUser(detail as EndUserDetailDto);
      const list = ((appList as unknown as { data?: ApplicationDto[] })?.data ??
        (appList as unknown as ApplicationDto[])) as ApplicationDto[];
      setApps(Array.isArray(list) ? list : []);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load end-user', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleGrant(appId: string) {
    try {
      const { error } = await endUserControllerGrantApp({
        path: { id: id as string, appId },
        body: { accessLevel: 'FULL' },
      });
      if (error) throw new Error((error as { message?: string })?.message || 'Failed to grant');
      toast('Access granted', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to grant', 'error');
    }
  }

  async function handleRevoke(appId: string) {
    try {
      const { error } = await endUserControllerRevokeApp({ path: { id: id as string, appId } });
      if (error) throw new Error((error as { message?: string })?.message || 'Failed to revoke');
      toast('Access revoked', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to revoke', 'error');
    }
  }

  async function handleBindIdentity(ehrName: string, fhirId: string) {
    try {
      const { error } = await endUserControllerBindExternalIdentity({
        path: { id: id as string },
        body: { ehrName: ehrName.trim(), fhirId: fhirId.trim() },
      });
      if (error) throw new Error((error as { message?: string })?.message || 'Failed to bind identity');
      toast('Provider FHIR ID bound', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to bind identity', 'error');
    }
  }

  async function handleUnbindIdentity(ehrName: string, fhirId: string) {
    try {
      const { error } = await endUserControllerUnbindExternalIdentity({
        path: { id: id as string, ehrName, fhirId: encodeURIComponent(fhirId) },
      });
      if (error) throw new Error((error as { message?: string })?.message || 'Failed to unbind identity');
      toast('Provider FHIR ID unbound', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to unbind identity', 'error');
    }
  }

  if (loading) {
    return <div className="p-12 text-center text-surface-on-variant">Loading…</div>;
  }
  if (!user) {
    return <div className="p-12 text-center text-surface-on-variant">End-user not found.</div>;
  }

  const display = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
  const grantedAppIds = new Set(user.apps.map((a) => a.applicationId));
  const ungrantedApps = apps.filter((a) => !grantedAppIds.has(a.id));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push('/dashboard/end-users')}
            className="text-xs text-surface-on-variant hover:text-surface-on mb-1"
          >
            ← Back to End Users
          </button>
          <h1 className="text-3xl font-bold text-surface-on">{display}</h1>
          <p className="text-sm text-surface-on-variant mt-1">{user.email}</p>
        </div>
        <span
          className={`badge ${
            user.status === 'ACTIVE' ? 'badge-active' : user.status === 'PENDING' ? 'badge-pending' : 'badge-disabled'
          }`}
        >
          {user.status}
        </span>
      </div>

      <div className="border-b flex gap-1">
        {(
          [
            ['profile', 'Profile'],
            ['apps', `Apps (${user.apps.length})`],
            ['sites', `Sites (${user.sites.length})`],
            ['identities', `External IDs (${user.externalIdentities.length})`],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-surface-on-variant hover:text-surface-on'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab user={user} />}

      {tab === 'apps' && (
        <div className="aegis-card overflow-hidden">
          <table className="aegis-table">
            <thead>
              <tr>
                <th className="pl-6">Application</th>
                <th>Access Level</th>
                <th>Granted Via</th>
                <th>Granted At</th>
                <th className="pr-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {user.apps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-surface-on-variant text-sm">
                    No application access yet.
                  </td>
                </tr>
              ) : (
                user.apps.map((a) => (
                  <tr key={a.applicationId}>
                    <td className="pl-6 py-3 font-bold">{a.applicationName}</td>
                    <td>
                      <span className="badge bg-blue-100 text-blue-700">{a.accessLevel}</span>
                    </td>
                    <td className="text-xs text-surface-on-variant">{a.grantSource}</td>
                    <td className="text-xs text-surface-on-variant">{new Date(a.grantedAt).toLocaleString()}</td>
                    <td className="pr-6">
                      {canManage && (
                        <Button
                          variant="link"
                          size="sm"
                          className="text-error"
                          confirmMessage={`Revoke access to ${a.applicationName}?`}
                          onClick={() => handleRevoke(a.applicationId)}
                        >
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {canManage && ungrantedApps.length > 0 && (
            <div className="border-t bg-surface-container-low/30 p-4">
              <p className="text-xs font-bold text-surface-on-variant uppercase tracking-wider mb-2">
                Grant new access
              </p>
              <div className="flex flex-wrap gap-2">
                {ungrantedApps.map((a) => (
                  <Button key={a.id} variant="secondary" size="sm" onClick={() => handleGrant(a.id)}>
                    + {a.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'sites' && (
        <div className="aegis-card overflow-hidden">
          <table className="aegis-table">
            <thead>
              <tr>
                <th className="pl-6">Site</th>
                <th>Application</th>
                <th>Access Level</th>
                <th className="pr-6">Granted At</th>
              </tr>
            </thead>
            <tbody>
              {user.sites.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-surface-on-variant text-sm">
                    No site-level scoping. User has app-wide access via Apps tab.
                  </td>
                </tr>
              ) : (
                user.sites.map((s) => (
                  <tr key={s.siteId}>
                    <td className="pl-6 py-3 font-bold">{s.siteName}</td>
                    <td>{s.applicationName}</td>
                    <td>
                      <span className="badge bg-blue-100 text-blue-700">{s.accessLevel}</span>
                    </td>
                    <td className="pr-6 text-xs text-surface-on-variant">{new Date(s.grantedAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'identities' && (
        <ExternalIdentitiesTab
          identities={user.externalIdentities}
          canManage={canManage}
          onBind={handleBindIdentity}
          onUnbind={handleUnbindIdentity}
        />
      )}
    </div>
  );
}

function ExternalIdentitiesTab({
  identities,
  canManage,
  onBind,
  onUnbind,
}: {
  identities: EndUserDetailDto['externalIdentities'];
  canManage: boolean;
  onBind: (ehrName: string, fhirId: string) => Promise<void>;
  onUnbind: (ehrName: string, fhirId: string) => Promise<void>;
}) {
  const [ehrName, setEhrName] = useState('');
  const [fhirId, setFhirId] = useState('');
  const [adding, setAdding] = useState(false);

  async function submit() {
    if (!ehrName.trim() || !fhirId.trim()) return;
    setAdding(true);
    try {
      await onBind(ehrName, fhirId);
      setEhrName('');
      setFhirId('');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="aegis-card overflow-hidden">
      <table className="aegis-table">
        <thead>
          <tr>
            <th className="pl-6">EHR</th>
            <th>FHIR ID</th>
            <th>Email at first launch</th>
            <th>Last Seen</th>
            {canManage && <th className="pr-6">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {identities.length === 0 ? (
            <tr>
              <td colSpan={canManage ? 5 : 4} className="p-8 text-center text-surface-on-variant text-sm">
                No EHR identities bound. Add one below to allow SMART standalone launches before the first launch.
              </td>
            </tr>
          ) : (
            identities.map((ei) => (
              <tr key={`${ei.ehrName}-${ei.fhirId}`}>
                <td className="pl-6 py-3 font-bold uppercase">{ei.ehrName}</td>
                <td className="font-mono text-xs">{ei.fhirId}</td>
                <td className="text-xs text-surface-on-variant">{ei.emailAtSeen ?? '—'}</td>
                <td className="text-xs text-surface-on-variant">{new Date(ei.lastSeenAt).toLocaleString()}</td>
                {canManage && (
                  <td className="pr-6">
                    <Button
                      variant="link"
                      size="sm"
                      className="text-error"
                      confirmMessage={`Unbind ${ei.ehrName} ${ei.fhirId}? This user can no longer launch from this provider record until rebound.`}
                      onClick={() => onUnbind(ei.ehrName, ei.fhirId)}
                    >
                      Unbind
                    </Button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {canManage && (
        <div className="border-t bg-surface-container-low/30 p-4 flex gap-2 items-end">
          <div>
            <label className="block text-xs font-bold text-surface-on-variant uppercase tracking-wider mb-1">EHR</label>
            <input
              type="text"
              value={ehrName}
              onChange={(e) => setEhrName(e.target.value)}
              placeholder="cerner"
              className="aegis-input w-32"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-surface-on-variant uppercase tracking-wider mb-1">
              FHIR ID
            </label>
            <input
              type="text"
              value={fhirId}
              onChange={(e) => setFhirId(e.target.value)}
              placeholder="Practitioner/12345"
              className="aegis-input w-full"
            />
          </div>
          <Button variant="primary" size="sm" loading={adding} loadingText="Binding..." onClick={submit}>
            + Bind
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Read-only profile view. Profile fields (firstName/lastName/NPI/specialty)
 * are owned by the EHR/the user, not by admin. Admin's role on this page is
 * to grant or revoke access — see the Apps and Sites tabs.
 */
function ProfileTab({ user }: { user: EndUserDetailDto }) {
  return (
    <div className="aegis-card p-6 max-w-2xl space-y-4">
      <Field label="Email" value={user.email} />
      <div className="grid grid-cols-2 gap-4">
        <Field label="First Name" value={user.firstName ?? '—'} />
        <Field label="Last Name" value={user.lastName ?? '—'} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="NPI" value={user.npi ?? '—'} />
        <Field label="Specialty" value={user.specialty ?? '—'} />
      </div>
      <p className="text-xs text-surface-on-variant pt-2 border-t">
        Profile is sourced from the EHR / the end-user's own account. To grant or revoke this user's access, use the
        Apps tab.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-surface-on-variant uppercase tracking-wider mb-1">{label}</label>
      <p className="text-sm text-surface-on">{value}</p>
    </div>
  );
}
