'use client';

import { useAllergies, useConditions, useMedications, useVitals } from '@/hooks/useResource';
import type { AllergySummary, ConditionSummary, MedicationSummary, VitalSummary } from '@/types';
import { capitalize, formatSystem } from '@/lib/coding-display';
import { getConditionStateOption } from '@/lib/condition-states';
import { AllergyRow, ConditionRow, MedicationRow, VitalTile } from './ClinicalRows';
import type { ItemField } from './ItemDetailModal';
import { ResourceDetailModal } from './ResourceDetailModal';

// Per-resource wrappers around the generic <ResourceDetailModal>. Each
// wraps a hook (with includeInactive=true, so the modal pays the full-
// history fetch only when opened) and a per-resource field list for the
// drill-down. Row markup is shared with the Clinical Summary 2x2 grid via
// the components in `./ClinicalRows`.

// ─── Conditions ──────────────────────────────────────────────────────────

export function ConditionsDetailModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, loading } = useConditions({ includeInactive: true });
  return (
    <ResourceDetailModal<ConditionSummary>
      open={open}
      onClose={onClose}
      title="Conditions — full history"
      loading={loading}
      items={data ?? []}
      isActive={(c) => c.clinicalStatus === 'active'}
      itemKey={(c) => c.id || `${c.icdCode}-${c.recordedDate ?? ''}`}
      itemTitle={(c) => c.name}
      itemFields={conditionFields}
      renderItem={(c) => <ConditionRow condition={c} />}
    />
  );
}

function conditionFields(c: ConditionSummary): ItemField[] {
  const codings = c.codings?.length ? c.codings : c.icdCode ? [{ system: c.codeSystem, code: c.icdCode }] : [];
  const stateOption = getConditionStateOption(c.stateValue);
  const severityDisplay = c.severityLevel ? capitalize(c.severityLevel) : c.severity;
  return [
    {
      label: 'Codes',
      value: codings.length ? (
        <div className="flex flex-wrap gap-2">
          {codings.map((coding) => (
            <span
              key={`${coding.system}-${coding.code}`}
              className="inline-flex items-center gap-1.5 text-xs font-mono bg-surface-container-low px-2 py-0.5 rounded"
            >
              <span className="text-[10px] uppercase tracking-wider text-surface-on-variant font-sans font-medium">
                {formatSystem(coding.system)}
              </span>
              {coding.code}
            </span>
          ))}
        </div>
      ) : undefined,
    },
    { label: 'Category', value: c.category === 'encounter-diagnosis' ? 'Encounter diagnosis' : 'Problem list item' },
    {
      label: 'State',
      value: (
        <span className={`inline-block text-xs px-2 py-0.5 rounded border ${stateOption.color}`}>
          {stateOption.label}
        </span>
      ),
    },
    { label: 'Severity', value: severityDisplay },
    { label: 'Onset', value: c.onsetDate },
    { label: 'Recorded', value: c.recordedDate },
    { label: 'Last updated', value: c.lastUpdated },
    { label: 'Notes', value: c.notes?.length ? <NotesList notes={c.notes} /> : undefined },
  ];
}

// ─── Allergies ───────────────────────────────────────────────────────────

export function AllergiesDetailModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, loading } = useAllergies({ includeInactive: true });
  return (
    <ResourceDetailModal<AllergySummary>
      open={open}
      onClose={onClose}
      title="Allergies — full history"
      loading={loading}
      items={data ?? []}
      isActive={(a) => a.clinicalStatus === 'active'}
      itemKey={(a) => a.id || `${a.code}-${a.substance}`}
      itemTitle={(a) => a.substance}
      itemFields={allergyFields}
      renderItem={(a) => <AllergyRow allergy={a} />}
    />
  );
}

function allergyFields(a: AllergySummary): ItemField[] {
  return [
    { label: 'Code', value: a.code },
    { label: 'Type', value: a.type },
    { label: 'Clinical status', value: a.clinicalStatus },
    { label: 'Criticality', value: a.criticality },
    {
      label: 'Reactions',
      value: a.reactions?.length ? (
        <ul className="space-y-1 list-disc list-inside text-sm">
          {a.reactions.map((r, i) => (
            <li key={i}>
              {r.manifestation} {r.severity && r.severity !== 'unknown' ? `(${r.severity})` : ''}
            </li>
          ))}
        </ul>
      ) : undefined,
    },
    { label: 'Onset', value: a.onsetDate },
    { label: 'Recorded', value: a.recordedDate },
    { label: 'Last updated', value: a.lastUpdated },
    { label: 'Notes', value: a.notes?.length ? <NotesList notes={a.notes} /> : undefined },
  ];
}

// ─── Medications ─────────────────────────────────────────────────────────

export function MedicationsDetailModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, loading } = useMedications({ includeInactive: true });
  return (
    <ResourceDetailModal<MedicationSummary>
      open={open}
      onClose={onClose}
      title="Medications — full history"
      loading={loading}
      items={data ?? []}
      isActive={(m) => m.status === 'active'}
      itemKey={(m) => m.id || `${m.code}-${m.startDate ?? ''}`}
      itemTitle={(m) => m.name}
      itemFields={medicationFields}
      renderItem={(m) => <MedicationRow medication={m} />}
    />
  );
}

function medicationFields(m: MedicationSummary): ItemField[] {
  return [
    { label: 'Code', value: m.code },
    { label: 'Status', value: m.status },
    { label: 'Dosage', value: m.dosage },
    { label: 'Route', value: m.route },
    { label: 'Frequency', value: m.frequency },
    { label: 'Started', value: m.startDate },
    { label: 'Recorded', value: m.recordedDate },
    { label: 'Last updated', value: m.lastUpdated },
    { label: 'Notes', value: m.notes?.length ? <NotesList notes={m.notes} /> : undefined },
  ];
}

// ─── Observations / Vitals ───────────────────────────────────────────────
// FHIR Observations don't carry an active/inactive concept — historical
// readings only — so isActive returns true and everything stays in the
// Active section. The drill-down still exposes per-vital details.

export function ObservationsDetailModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, loading } = useVitals();
  return (
    <ResourceDetailModal<VitalSummary>
      open={open}
      onClose={onClose}
      title="Observations — recent"
      loading={loading}
      items={data ?? []}
      isActive={() => true}
      activeLabel="All readings"
      itemKey={(v) => v.id || `${v.code}-${v.date}`}
      itemTitle={(v) => v.name}
      itemFields={vitalFields}
      renderItem={(v) => (
        <div className="space-y-0.5">
          <VitalTile vital={v} />
        </div>
      )}
    />
  );
}

function vitalFields(v: VitalSummary): ItemField[] {
  return [
    { label: 'Code', value: v.code },
    {
      label: 'Value',
      value: (
        <span className={v.isAbnormal ? 'text-red-600 font-semibold' : ''}>
          {v.value} {v.unit}
        </span>
      ),
    },
    { label: 'Interpretation', value: v.interpretation },
    { label: 'Abnormal', value: v.isAbnormal ? 'Yes' : undefined },
    { label: 'Recorded', value: v.date ? new Date(v.date).toLocaleString() : undefined },
    { label: 'Issued', value: v.issuedDate ? new Date(v.issuedDate).toLocaleString() : undefined },
    { label: 'Last updated', value: v.lastUpdated },
    { label: 'Notes', value: v.notes?.length ? <NotesList notes={v.notes} /> : undefined },
  ];
}

// ─── Shared bits ─────────────────────────────────────────────────────────

function NotesList({ notes }: { notes: string[] }) {
  return (
    <ul className="space-y-1 list-disc list-inside text-sm">
      {notes.map((n, i) => (
        <li key={i}>{n}</li>
      ))}
    </ul>
  );
}
