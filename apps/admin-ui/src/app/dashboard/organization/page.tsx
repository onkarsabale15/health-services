'use client';

import { useEffect, useState } from 'react';
import { organizationControllerGetMyOrganization, organizationControllerUpdateOrganization } from '@/lib/sdk/generated';
import { getUser } from '@/lib/auth';
import { useToast } from '@/components/toast';
import { Button } from '@/components/button';

export default function OrganizationPage() {
  const [org, setOrg] = useState<any>(null);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [saving, setSaving] = useState(false);
  const currentUser = getUser();
  const { toast } = useToast();

  const isOwner = currentUser?.role === 'OWNER';

  useEffect(() => {
    loadOrg();
  }, []);

  async function loadOrg() {
    try {
      const { data, error: orgErr } = await organizationControllerGetMyOrganization();
      if (orgErr || !data) throw new Error((orgErr as any)?.message || 'Failed to load organization');
      setOrg(data);
      setName((data as any).name);
      setDomain((data as any).domain || '');
    } catch (err: any) {
      toast(err.message || 'Failed to load organization', 'error');
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error: updateErr } = await organizationControllerUpdateOrganization({
        body: { name, domain: domain || undefined },
      });
      if (updateErr) throw new Error((updateErr as any)?.message || 'Failed to update organization');
      toast('Organization settings updated', 'success');
      loadOrg();
    } catch (err: any) {
      toast(err.message || 'Failed to update organization', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!org)
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-surface-container-low w-1/4 rounded-round-four" />
        <div className="h-96 bg-surface-container-low w-full max-w-lg rounded-round-four" />
      </div>
    );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-surface-on">Organization Settings</h1>
        <p className="text-sm text-surface-on-variant mt-1">
          Configure clinical domain identity and member auto-join rules
        </p>
      </div>

      <div className="aegis-card max-w-lg overflow-visible">
        <div className="p-4 bg-surface-container-low/30 border-b border-surface-container-DEFAULT flex items-center justify-between">
          <h2 className="text-sm font-bold text-secondary uppercase tracking-widest">Identity & Access</h2>
          <span className="badge badge-production lowercase">{org.name.split(' ')[0]} Instance</span>
        </div>

        <div className="p-8 space-y-8">
          {isOwner ? (
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5 ml-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="aegis-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5 ml-1">
                  Verified Domain
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="aegis-input"
                  placeholder="e.g., medicalcenter.org"
                />
                <p className="text-[10px] text-surface-on-variant mt-2 ml-1 leading-tight font-medium">
                  Users signing up with this email domain will automatically join your organization.
                </p>
              </div>

              <div className="pt-4 flex items-center gap-4">
                <Button
                  type="submit"
                  variant="primary"
                  loading={saving}
                  loadingText="Saving..."
                  className="min-w-[140px]"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="aegis-section">
                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Organization Name</p>
                <p className="text-lg font-bold text-surface-on">{org.name}</p>
              </div>
              <div className="aegis-section">
                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Verified Domain</p>
                <p className="text-lg font-bold text-surface-on">
                  {org.domain || <span className="text-surface-container-highest italic text-sm">Not configured</span>}
                </p>
              </div>
              <div className="bg-tertiary-container/30 text-tertiary p-4 rounded-round-four text-xs font-bold flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path
                    fillRule="evenodd"
                    d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
                    clipRule="evenodd"
                  />
                </svg>
                Only the Organization Owner can modify these settings.
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-surface-container-low flex items-center justify-between">
            <div className="flex gap-4">
              <div className="text-center px-4 py-2 bg-surface-container-low rounded-round-four">
                <p className="text-[10px] font-bold text-secondary uppercase tracking-tighter">Apps</p>
                <p className="text-xl font-bold text-primary">{org._count?.applications ?? 0}</p>
              </div>
              <div className="text-center px-4 py-2 bg-surface-container-low rounded-round-four">
                <p className="text-[10px] font-bold text-secondary uppercase tracking-tighter">Users</p>
                <p className="text-xl font-bold text-primary">{org._count?.users ?? 0}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Instance Provisioned</p>
              <p className="text-xs font-bold text-surface-on-variant mt-1">
                {new Date(org.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
