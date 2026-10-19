'use client';

import { motion } from 'framer-motion';
import { Plus, Stethoscope, AlertTriangle } from 'lucide-react';
import { CapabilityGatedButton } from '@/components/CapabilityGatedButton';
import { fadeInUp } from '@/lib/motion';
import type { ResourceCapabilities } from '@/lib/capabilities.types';

// Consolidates write actions into a single toolbar so clinicians don't
// hunt across four section headers. Renders nothing when no action is
// supported (e.g. read-only EHR).

interface ResourceState {
  capabilities: ResourceCapabilities | null;
  loading: boolean;
}

interface Props {
  conditions: ResourceState;
  vitals: ResourceState;
  allergies: ResourceState;
  onAddCondition: () => void;
  onRecordVital: () => void;
  onAddAllergy: () => void;
}

export function ClinicalActionBar({
  conditions,
  vitals,
  allergies,
  onAddCondition,
  onRecordVital,
  onAddAllergy,
}: Props) {
  const allowCondition = !conditions.loading && conditions.capabilities?.allowAdd;
  const allowVital = !vitals.loading && vitals.capabilities?.allowAdd;
  const allowAllergy = !allergies.loading && allergies.capabilities?.allowAdd;

  // Don't render an empty bar when nothing is supported.
  if (!allowCondition && !allowVital && !allowAllergy) return null;

  return (
    <motion.div
      variants={fadeInUp}
      className="cds-card-elevated px-4 py-3 flex flex-wrap items-center gap-2"
      role="toolbar"
      aria-label="Add clinical record"
    >
      <span className="text-xs font-medium text-secondary uppercase tracking-wide mr-2">Add</span>

      <CapabilityGatedButton
        allow={allowCondition}
        capabilities={conditions.capabilities}
        onClick={onAddCondition}
        icon={<Plus size={14} />}
      >
        Condition
      </CapabilityGatedButton>

      <CapabilityGatedButton
        allow={allowVital}
        capabilities={vitals.capabilities}
        onClick={onRecordVital}
        icon={<Stethoscope size={14} />}
      >
        Vital
      </CapabilityGatedButton>

      <CapabilityGatedButton
        allow={allowAllergy}
        capabilities={allergies.capabilities}
        onClick={onAddAllergy}
        icon={<AlertTriangle size={14} />}
      >
        Allergy
      </CapabilityGatedButton>
    </motion.div>
  );
}
