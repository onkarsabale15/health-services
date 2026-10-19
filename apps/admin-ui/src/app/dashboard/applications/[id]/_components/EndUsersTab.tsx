'use client';

import { useEffect, useState } from 'react';
import { endUserControllerListAllowedAppUsers, endUserControllerRevokeApp } from '@/lib/sdk/generated';
import type { AllowedAppUserDto, EndUserSummaryDto } from '@/lib/sdk/generated';
import { Button } from '@/components/button';
import { useToast } from '@/components/toast';
import { InviteEndUserDrawer } from '../../../end-users/_components/InviteEndUserDrawer';

interface Props {
  appId: string;
  appName: string;
  isReadonly: boolean;
}

export default function EndUsersTab({ appId, appName, isReadonly }: Props) {
  const [users, setUsers] = useState<AllowedAppUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    void load();
  }, [appId]);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await endUserControllerListAllowedAppUsers({ path: { appId } });
      if (error) throw new Error((error as { message?: string })?.message || 'Failed to load end-users');
      setUsers((data as AllowedAppUserDto[]) || []);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load end-users', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(endUserId: string, email: string) {
    try {
      const { error } = await endUserControllerRevokeApp({ path: { id: endUserId, appId } });
      if (error) throw new Error((error as { message?: string })?.message || 'Failed to revoke');
      toast(`Revoked ${email}`, 'success');
      setUsers((prev) => prev.filter((u) => u.endUserId !== endUserId));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to revoke', 'error');
    }
  }

  function onInvited(_: EndUserSummaryDto) {
    setDrawerOpen(false);
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-secondary uppercase tracking-widest">Allowed End-Users</h3>
          <p className="text-xs text-surface-on-variant mt-1">
            Clinicians and providers authorized to launch <span className="font-bold">{appName}</span>.
          </p>
        </div>
        {!isReadonly && (
          <Button variant="primary" size="sm" onClick={() => setDrawerOpen(true)}>
            + Grant Access
          </Button>
        )}
      </div>

      <div className="aegis-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-surface-on-variant text-sm">Loading…</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-surface-on-variant text-sm">
            No end-users have access yet.{' '}
            {!isReadonly && (
              <button onClick={() => setDrawerOpen(true)} className="text-primary font-bold hover:underline">
                Grant access
              </button>
            )}
          </div>
        ) : (
          <table className="aegis-table">
            <thead>
              <tr>
                <th className="pl-6">User</th>
                <th>Access Level</th>
                <th>Granted Via</th>
                <th>Granted At</th>
                <th>Last Login</th>
                <th className="pr-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const display = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email;
                return (
                  <tr key={u.endUserId}>
                    <td className="pl-6 py-3">
                      <p className="font-bold text-surface-on">{display}</p>
                      <p className="text-xs text-surface-on-variant">{u.email}</p>
                    </td>
                    <td>
                      <span className="badge bg-blue-100 text-blue-700">{u.accessLevel}</span>
                    </td>
                    <td className="text-xs text-surface-on-variant">{u.grantSource}</td>
                    <td className="text-xs text-surface-on-variant">{new Date(u.grantedAt).toLocaleString()}</td>
                    <td className="text-xs text-surface-on-variant">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="pr-6">
                      {!isReadonly && (
                        <Button
                          variant="link"
                          size="sm"
                          className="text-error"
                          confirmMessage={`Revoke ${u.email}'s access to ${appName}?`}
                          onClick={() => handleRevoke(u.endUserId, u.email)}
                        >
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {drawerOpen && (
        <InviteEndUserDrawer onClose={() => setDrawerOpen(false)} onCreated={onInvited} preselectAppId={appId} />
      )}
    </div>
  );
}
