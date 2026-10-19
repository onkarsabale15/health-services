'use client';

import { useEffect, useState } from 'react';
import { applicationControllerListApplications, endUserControllerCreate } from '@/lib/sdk/generated';
import type { ApplicationDto, EndUserDetailDto, EndUserSummaryDto } from '@/lib/sdk/generated';
import { useToast } from '@/components/toast';
import { Button } from '@/components/button';

interface Props {
  onClose: () => void;
  onCreated: (user: EndUserSummaryDto) => void;
  preselectAppId?: string;
}

interface ExternalIdRow {
  ehrName: string;
  fhirId: string;
}

export function InviteEndUserDrawer({ onClose, onCreated, preselectAppId }: Props) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [npi, setNpi] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [apps, setApps] = useState<ApplicationDto[]>([]);
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>(preselectAppId ? [preselectAppId] : []);
  const [externalIds, setExternalIds] = useState<ExternalIdRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingApps, setLoadingApps] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await applicationControllerListApplications();
        const list = ((data as unknown as { data?: ApplicationDto[] })?.data ??
          (data as unknown as ApplicationDto[])) as ApplicationDto[];
        if (mounted) setApps(Array.isArray(list) ? list : []);
      } catch {
        // toast handled below if invite fails — apps list is optional
      } finally {
        if (mounted) setLoadingApps(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function toggleApp(appId: string) {
    setSelectedAppIds((prev) => (prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]));
  }

  function addExternalIdRow() {
    setExternalIds((prev) => [...prev, { ehrName: '', fhirId: '' }]);
  }
  function updateExternalIdRow(idx: number, field: keyof ExternalIdRow, value: string) {
    setExternalIds((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  }
  function removeExternalIdRow(idx: number) {
    setExternalIds((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast('Email is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const cleanedExternalIds = externalIds
        .map((r) => ({ ehrName: r.ehrName.trim(), fhirId: r.fhirId.trim() }))
        .filter((r) => r.ehrName && r.fhirId);
      const { data, error } = await endUserControllerCreate({
        body: {
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          npi: npi.trim() || undefined,
          specialty: specialty.trim() || undefined,
          applicationIds: selectedAppIds.length ? selectedAppIds : undefined,
          externalIdentities: cleanedExternalIds.length ? cleanedExternalIds : undefined,
        },
      });
      if (error) throw new Error((error as { message?: string })?.message || 'Failed to invite end-user');
      const detail = data as EndUserDetailDto;
      onCreated({
        id: detail.id,
        email: detail.email,
        emailVerified: detail.emailVerified,
        firstName: detail.firstName,
        lastName: detail.lastName,
        npi: detail.npi,
        specialty: detail.specialty,
        status: detail.status,
        organizationId: detail.organizationId,
        lastLoginAt: detail.lastLoginAt,
        appsCount: detail.apps?.length ?? 0,
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to invite end-user', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={onClose} />
      <aside
        className="fixed right-0 top-0 h-screen w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-surface-on">Invite End-User</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-surface-on-variant hover:text-surface-on text-xl leading-none"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-surface-on-variant uppercase tracking-wider mb-1">
              Email <span className="text-error">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="aegis-input w-full"
              placeholder="dr.smith@hospital.org"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-surface-on-variant uppercase tracking-wider mb-1">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="aegis-input w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-surface-on-variant uppercase tracking-wider mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="aegis-input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-surface-on-variant uppercase tracking-wider mb-1">
                NPI
              </label>
              <input type="text" value={npi} onChange={(e) => setNpi(e.target.value)} className="aegis-input w-full" />
            </div>
            <div>
              <label className="block text-xs font-bold text-surface-on-variant uppercase tracking-wider mb-1">
                Specialty
              </label>
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="aegis-input w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-surface-on-variant uppercase tracking-wider mb-2">
              Grant access to applications
            </label>
            {loadingApps ? (
              <p className="text-xs text-surface-on-variant">Loading…</p>
            ) : apps.length === 0 ? (
              <p className="text-xs text-surface-on-variant">No applications available.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                {apps.map((app) => (
                  <label key={app.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAppIds.includes(app.id)}
                      onChange={() => toggleApp(app.id)}
                      className="h-4 w-4 text-primary border-surface-container-DEFAULT rounded focus:ring-primary"
                    />
                    <span className="font-medium text-surface-on">{app.name}</span>
                    <span className="text-xs text-surface-on-variant">{app.appType}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-surface-on-variant mt-2">
              The user will receive an email invitation with sign-in instructions.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-surface-on-variant uppercase tracking-wider mb-2">
              EHR Provider FHIR IDs <span className="text-surface-on-variant lowercase font-normal">(optional)</span>
            </label>
            <p className="text-xs text-surface-on-variant mb-2">
              Pre-bind this user to known FHIR IDs so SMART standalone launches resolve instantly. Useful when the EHR
              doesn't expose email in id_token or Practitioner.telecom.
            </p>
            {externalIds.length > 0 && (
              <div className="space-y-2 mb-2">
                {externalIds.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={row.ehrName}
                      onChange={(e) => updateExternalIdRow(idx, 'ehrName', e.target.value)}
                      placeholder="cerner"
                      className="aegis-input w-32"
                    />
                    <input
                      type="text"
                      value={row.fhirId}
                      onChange={(e) => updateExternalIdRow(idx, 'fhirId', e.target.value)}
                      placeholder="Practitioner/12345"
                      className="aegis-input flex-1"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeExternalIdRow(idx)}>
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button variant="secondary" size="sm" onClick={addExternalIdRow}>
              + Add provider FHIR ID
            </Button>
          </div>
        </form>

        <footer className="flex justify-end gap-2 p-4 border-t bg-surface-container-low/30">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            loading={submitting}
            loadingText="Inviting..."
            disabled={!email.trim()}
          >
            Send Invite
          </Button>
        </footer>
      </aside>
    </>
  );
}
