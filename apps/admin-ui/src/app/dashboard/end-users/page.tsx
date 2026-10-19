'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { endUserControllerList } from '@/lib/sdk/generated';
import type { EndUserSummaryDto } from '@/lib/sdk/generated';
import { getUser } from '@/lib/auth';
import { useToast } from '@/components/toast';
import { Button } from '@/components/button';
import { InviteEndUserDrawer } from './_components/InviteEndUserDrawer';

type StatusFilter = '' | 'PENDING' | 'ACTIVE' | 'DISABLED';

export default function EndUsersPage() {
  const [users, setUsers] = useState<EndUserSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toast } = useToast();
  const currentUser = getUser();
  const canManage = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  useEffect(() => {
    void load();
  }, [statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await endUserControllerList({
        query: { ...(statusFilter ? { status: statusFilter } : {}) },
      });
      if (error) throw new Error((error as { message?: string })?.message || 'Failed to load end-users');
      setUsers((data as EndUserSummaryDto[]) || []);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load end-users', 'error');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim().toLowerCase();
      return u.email.toLowerCase().includes(q) || name.includes(q) || (u.npi ?? '').includes(q);
    });
  }, [users, search]);

  function onCreated(created: EndUserSummaryDto) {
    setUsers((prev) => [created, ...prev]);
    setDrawerOpen(false);
    toast('End-user invited', 'success');
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-surface-on">End Users</h1>
          <p className="text-sm text-surface-on-variant mt-1">
            Clinicians and providers granted access to your applications.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="badge badge-production">
            {filtered.length} of {users.length}
          </div>
          {canManage && (
            <Button variant="primary" onClick={() => setDrawerOpen(true)}>
              Invite End-User
            </Button>
          )}
        </div>
      </div>

      <div className="aegis-card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-bold text-surface-on-variant uppercase tracking-wider mb-1">
            Search
          </label>
          <input
            type="text"
            placeholder="Email, name, or NPI"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="aegis-input w-full"
          />
        </div>
        <div className="w-44">
          <label className="block text-xs font-bold text-surface-on-variant uppercase tracking-wider mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="aegis-input w-full"
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </div>
      </div>

      <div className="aegis-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-surface-on-variant text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-surface-on-variant text-sm mb-3">
              {users.length === 0 ? 'No end-users yet.' : 'No matches.'}
            </p>
            {canManage && users.length === 0 && (
              <Button variant="primary" size="sm" onClick={() => setDrawerOpen(true)}>
                Invite your first end-user
              </Button>
            )}
          </div>
        ) : (
          <table className="aegis-table">
            <thead>
              <tr>
                <th className="pl-6">Name</th>
                <th>Email</th>
                <th>Apps</th>
                <th>Last Login</th>
                <th className="pr-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const display = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || '—';
                return (
                  <tr key={u.id} className="group transition-colors">
                    <td className="pl-6 py-3">
                      <Link href={`/dashboard/end-users/${u.id}`} className="font-bold text-primary hover:underline">
                        {display}
                      </Link>
                      {u.specialty && <p className="text-xs text-surface-on-variant">{u.specialty}</p>}
                    </td>
                    <td className="text-surface-on-variant">{u.email}</td>
                    <td>
                      <span className="badge bg-surface-container-highest text-surface-on-variant">
                        {u.appsCount ?? 0}
                      </span>
                    </td>
                    <td className="text-surface-on-variant text-xs">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="pr-6">
                      <span
                        className={`badge ${
                          u.status === 'ACTIVE'
                            ? 'badge-active'
                            : u.status === 'PENDING'
                              ? 'badge-pending'
                              : 'badge-disabled'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {drawerOpen && <InviteEndUserDrawer onClose={() => setDrawerOpen(false)} onCreated={onCreated} />}
    </div>
  );
}
