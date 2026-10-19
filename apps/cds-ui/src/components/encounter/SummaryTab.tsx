'use client';

import { useCallback, useState } from 'react';
import type { AllergySummary, ConditionSummary, MedicationSummary, VitalSummary } from '@/types';
import type { useAllergies, useConditions, useMedications, useVitals } from '@/hooks/useResource';
import AllergyBanner from '@/components/AllergyBanner';
import { ClinicalActionBar } from '@/components/ClinicalActionBar';
import Modal from '@/components/Modal';
import ConditionForm from '@/components/ConditionForm';
import SearchInput from '@/components/SearchInput';
import { AllergyRow, ConditionRow, MedicationRow, VitalTile } from '@/components/ClinicalRows';
import { ClinicalSectionCard } from '@/components/ClinicalSectionCard';
import {
  AllergiesDetailModal,
  ConditionsDetailModal,
  MedicationsDetailModal,
  ObservationsDetailModal,
} from '@/components/clinical-detail-modals';
import { useClinicalSearch } from '@/hooks/useClinicalSearch';

const conditionSearchText = (c: ConditionSummary) => [c.name, c.icdCode, c.category, ...(c.notes ?? [])].join(' ');
const allergySearchText = (a: AllergySummary) =>
  [a.substance, ...(a.reactions?.map((r) => r.manifestation) ?? []), ...(a.notes ?? [])].join(' ');
const medicationSearchText = (m: MedicationSummary) => [m.name, m.dosage, m.route, ...(m.notes ?? [])].join(' ');
const vitalSearchText = (v: VitalSummary) => [v.name, v.code, ...(v.notes ?? [])].join(' ');

type ConditionModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'update'; condition: ConditionSummary };

type DetailModalKey = 'conditions' | 'observations' | 'allergies' | 'medications';

/**
 * Summary tab — the 2×2 active-clinical grid (Observations · Conditions ·
 * Medications · Allergies) with cross-resource search, inline condition
 * create/edit, and per-section "view all" history drawers. Resources are
 * provided by the encounter view so they're fetched once for the whole screen.
 */
export default function SummaryTab({
  conditions,
  allergies,
  medications,
  vitals,
}: {
  conditions: ReturnType<typeof useConditions>;
  allergies: ReturnType<typeof useAllergies>;
  medications: ReturnType<typeof useMedications>;
  vitals: ReturnType<typeof useVitals>;
}) {
  const [conditionModal, setConditionModal] = useState<ConditionModalState>({ open: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [openDetail, setOpenDetail] = useState<DetailModalKey | null>(null);

  const filteredConditions = useClinicalSearch(conditions.data, searchQuery, conditionSearchText);
  const filteredAllergies = useClinicalSearch(allergies.data, searchQuery, allergySearchText);
  const filteredMedications = useClinicalSearch(medications.data, searchQuery, medicationSearchText);
  const filteredVitals = useClinicalSearch(vitals.data, searchQuery, vitalSearchText);

  const handleEditCondition = useCallback(
    (c: ConditionSummary) => setConditionModal({ open: true, mode: 'update', condition: c }),
    [],
  );
  const closeConditionModal = useCallback(() => setConditionModal({ open: false }), []);
  const handleConditionSaved = useCallback(() => {
    closeConditionModal();
    conditions.reload();
  }, [closeConditionModal, conditions]);

  return (
    <div className="space-y-4">
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search conditions, allergies, medications, vitals..."
      />

      <AllergyBanner allergies={allergies.data} />

      <ClinicalActionBar
        conditions={conditions}
        vitals={vitals}
        allergies={allergies}
        onAddCondition={() => setConditionModal({ open: true, mode: 'create' })}
        onRecordVital={() => alert('Record Observation — modal coming soon')}
        onAddAllergy={() => alert('Add Allergy — modal coming soon')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ClinicalSectionCard<VitalSummary>
          icon="monitoring"
          title="Observations"
          count={filteredVitals?.length ?? null}
          loading={vitals.loading}
          items={filteredVitals}
          layout="tile"
          emptyIcon="show_chart"
          emptyMessage={searchQuery ? 'No matching observations' : 'No observations recorded'}
          itemKey={(v) => v.id || `${v.code}-${v.date}`}
          renderItem={(v) => <VitalTile vital={v} />}
          onViewAll={() => setOpenDetail('observations')}
        />

        <ClinicalSectionCard<ConditionSummary>
          icon="clinical_notes"
          title="Active Conditions"
          count={filteredConditions?.length ?? null}
          loading={conditions.loading}
          items={filteredConditions}
          layout="list"
          emptyIcon="check_circle"
          emptyMessage={searchQuery ? 'No matching conditions' : 'No active conditions'}
          itemKey={(c) => c.id || `${c.icdCode}-${c.recordedDate ?? ''}`}
          renderItem={(c) => <ConditionRow condition={c} />}
          onItemClick={handleEditCondition}
          itemAriaLabel={(c) => `Edit ${c.name}`}
          onViewAll={() => setOpenDetail('conditions')}
        />

        <ClinicalSectionCard<MedicationSummary>
          icon="medication"
          title="Active Medications"
          count={filteredMedications?.length ?? null}
          loading={medications.loading}
          items={filteredMedications}
          layout="list"
          emptyIcon="medication"
          emptyMessage={searchQuery ? 'No matching medications' : 'No active medications'}
          itemKey={(m) => m.id || `${m.code}-${m.startDate ?? ''}`}
          renderItem={(m) => <MedicationRow medication={m} />}
          onViewAll={() => setOpenDetail('medications')}
        />

        <ClinicalSectionCard<AllergySummary>
          icon="warning"
          title="Allergies"
          count={filteredAllergies?.length ?? null}
          loading={allergies.loading}
          items={filteredAllergies}
          layout="list"
          emptyIcon="verified"
          emptyMessage={searchQuery ? 'No matching allergies' : 'No known allergies'}
          itemKey={(a) => a.id || `${a.code}-${a.substance}`}
          renderItem={(a) => <AllergyRow allergy={a} />}
          onViewAll={() => setOpenDetail('allergies')}
        />
      </div>

      <Modal
        open={conditionModal.open}
        onClose={closeConditionModal}
        title={conditionModal.open && conditionModal.mode === 'update' ? 'Update Condition' : 'Add Condition'}
      >
        {conditionModal.open && conditionModal.mode === 'create' && conditions.capabilities && (
          <ConditionForm
            mode="create"
            capabilities={conditions.capabilities}
            onSaved={handleConditionSaved}
            onCancel={closeConditionModal}
          />
        )}
        {conditionModal.open && conditionModal.mode === 'update' && conditions.capabilities && (
          <ConditionForm
            mode="update"
            existing={conditionModal.condition}
            capabilities={conditions.capabilities}
            onSaved={handleConditionSaved}
            onCancel={closeConditionModal}
          />
        )}
      </Modal>

      {openDetail === 'conditions' && <ConditionsDetailModal open onClose={() => setOpenDetail(null)} />}
      {openDetail === 'observations' && <ObservationsDetailModal open onClose={() => setOpenDetail(null)} />}
      {openDetail === 'allergies' && <AllergiesDetailModal open onClose={() => setOpenDetail(null)} />}
      {openDetail === 'medications' && <MedicationsDetailModal open onClose={() => setOpenDetail(null)} />}
    </div>
  );
}
