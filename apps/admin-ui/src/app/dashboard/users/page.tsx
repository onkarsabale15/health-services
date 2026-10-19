'use client';

import { useEffect, useState } from 'react';
import {
  userControllerListUsers,
  userControllerListPendingUsers,
  userControllerApproveUser,
  userControllerDisableUser,
  userControllerChangeRole,
} from '@/lib/sdk/generated';
import { getUser } from '@/lib/auth';
import { useToast } from '@/components/toast';
import { Button } from '@/components/button';
import type { User } from '@/types';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pending, setPending] = useState<User[]>([]);
  const currentUser = getUser();
  const { toast } = useToast();

  const canManage = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      if (canManage) {
        const [usersRes, pendingRes] = await Promise.all([userControllerListUsers(), userControllerListPendingUsers()]);
        setUsers((usersRes.data as any)?.data ?? []);
        setPending((pendingRes.data as any)?.data ?? []);
      } else {
        const { data: usersRes } = await userControllerListUsers();
        setUsers((usersRes as any)?.data ?? []);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to load users', 'error');
    }
  }

  async function handleApprove(userId: string) {
    try {
      const { error: approveErr } = await userControllerApproveUser({ path: { id: userId } });
      if (approveErr) throw new Error((approveErr as any)?.message || 'Failed to approve user');
      toast('User approved', 'success');
      const approved = pending.find((u) => u.id === userId);
      setPending((prev) => prev.filter((u) => u.id !== userId));
      if (approved) {
        setUsers((prev) => [...prev, { ...approved, status: 'ACTIVE' }]);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to approve user', 'error');
    }
  }

  async function handleDisable(userId: string) {
    try {
      const { error: disableErr } = await userControllerDisableUser({ path: { id: userId } });
      if (disableErr) throw new Error((disableErr as any)?.message || 'Failed to disable user');
      toast('User disabled', 'success');
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: 'DISABLED' } : u)));
    } catch (err: any) {
      toast(err.message || 'Failed to disable user', 'error');
    }
  }

  async function handleChangeRole(userId: string, role: User['role']) {
    try {
      const { error: roleErr } = await userControllerChangeRole({ path: { id: userId }, body: { role } } as any);
      if (roleErr) throw new Error((roleErr as any)?.message || 'Failed to change role');
      toast(`Role updated to ${role}`, 'success');
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } catch (err: any) {
      toast(err.message || 'Failed to change role', 'error');
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-surface-on">Users</h1>
          <p className="text-sm text-surface-on-variant mt-1">
            Manage organization members and clinical access permissions
          </p>
        </div>
        <div className="badge badge-production">{users.length} Total Users</div>
      </div>

      {/* Pending Approvals — Standardized Banner */}
      {canManage && pending.length > 0 && (
        <div className="aegis-section bg-yellow-50 border-0 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-yellow-500 text-white p-1 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-yellow-800 tracking-tight">
              Pending User Approvals ({pending.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pending.map((user) => (
              <div
                key={user.id}
                className="bg-white/80 backdrop-blur-sm rounded-round-four p-4 flex items-center justify-between shadow-sm border border-yellow-200/50"
              >
                <div className="min-w-0">
                  <p className="font-bold text-surface-on truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-surface-on-variant truncate">{user.email}</p>
                </div>
                <Button variant="success" size="sm" onClick={() => handleApprove(user.id)}>
                  APPROVE
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Users Table */}
      <div className="aegis-card">
        <div className="p-4 bg-surface-container-low/30 border-b border-surface-container-DEFAULT flex items-center justify-between">
          <h2 className="text-sm font-bold text-secondary uppercase tracking-widest">Organization Directory</h2>
          <span className="text-[10px] font-bold text-primary-dim uppercase tracking-tighter">
            Verified Clinicians & Staff
          </span>
        </div>
        <table className="aegis-table">
          <thead>
            <tr>
              <th className="pl-6">Full Name</th>
              <th>Email Address</th>
              <th>Platform Role</th>
              <th>Status</th>
              {canManage && <th className="pr-6 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="group transition-colors">
                <td className="pl-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-surface-container-highest flex items-center justify-center text-[10px] font-bold text-primary">
                      {user.firstName[0]}
                      {user.lastName[0]}
                    </div>
                    <span className="font-bold text-surface-on">
                      {user.firstName} {user.lastName}
                    </span>
                    {user.id === currentUser?.userId && (
                      <span className="badge bg-surface-container-DEFAULT text-surface-on-variant lowercase italic">
                        (you)
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-surface-on-variant font-medium">{user.email}</td>
                <td>
                  {currentUser?.role === 'OWNER' && user.id !== currentUser.userId && user.role !== 'OWNER' ? (
                    <select
                      value={user.role}
                      onChange={(e) => handleChangeRole(user.id, e.target.value as User['role'])}
                      className="aegis-input py-1 text-[11px] font-bold uppercase w-28 bg-white border border-surface-container-DEFAULT"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="MEMBER">MEMBER</option>
                    </select>
                  ) : (
                    <span
                      className={`badge ${
                        user.role === 'OWNER'
                          ? 'bg-purple-100 text-purple-700'
                          : user.role === 'ADMIN'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-surface-container-highest text-surface-on-variant'
                      }`}
                    >
                      {user.role}
                    </span>
                  )}
                </td>
                <td>
                  <span
                    className={`badge ${
                      user.status === 'ACTIVE'
                        ? 'badge-active'
                        : user.status === 'PENDING'
                          ? 'badge-pending'
                          : 'badge-disabled'
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                {canManage && (
                  <td className="pr-6 text-right">
                    {user.status === 'ACTIVE' && user.id !== currentUser?.userId && user.role !== 'OWNER' && (
                      <Button
                        variant="link"
                        size="sm"
                        className="text-[10px] font-bold text-error uppercase hover:underline"
                        confirmMessage="Disable this user? This will revoke all application access."
                        onClick={() => handleDisable(user.id)}
                      >
                        Disable Access
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
