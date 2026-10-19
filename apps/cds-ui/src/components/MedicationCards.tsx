'use client';

import { useState } from 'react';
import type { MedicationSummary } from '@/types';
import Modal from './Modal';
import ItemMeta from './ItemMeta';

const MAX_VISIBLE = 4;

function MedCard({ m }: { m: MedicationSummary }) {
  return (
    <div className="bg-surface-container-low rounded-lg px-4 py-3 min-w-[180px]">
      <p className="font-medium text-sm text-surface-on leading-tight">{m.name}</p>
      {m.dosage && <p className="text-xs text-secondary mt-1">{m.dosage}</p>}
      {m.route && <p className="text-[10px] text-secondary">{m.route}</p>}
      {m.frequency && <p className="text-[10px] text-secondary">{m.frequency}</p>}
      <ItemMeta recordedDate={m.recordedDate} lastUpdated={m.lastUpdated} notes={m.notes} />
    </div>
  );
}

export default function MedicationCards({ medications }: { medications: MedicationSummary[] }) {
  const [showAll, setShowAll] = useState(false);

  if (!medications.length) return null;

  const visible = medications.slice(0, MAX_VISIBLE);
  const hasMore = medications.length > MAX_VISIBLE;

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-ambient p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] uppercase tracking-wider font-bold text-secondary">Active Medications</h3>
        {hasMore && (
          <button onClick={() => setShowAll(true)} className="text-xs font-semibold text-primary hover:underline">
            View all {medications.length}
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {visible.map((m) => (
          <MedCard key={m.id} m={m} />
        ))}
        {hasMore && (
          <button
            onClick={() => setShowAll(true)}
            className="shrink-0 bg-surface-container-low/50 border border-dashed border-surface-container-high rounded-lg px-4 py-3 min-w-[120px] flex items-center justify-center text-sm text-primary font-medium hover:bg-surface-container-low transition-colors"
          >
            +{medications.length - MAX_VISIBLE} more
          </button>
        )}
      </div>
      <Modal open={showAll} onClose={() => setShowAll(false)} title={`Active Medications (${medications.length})`}>
        <div className="grid grid-cols-2 gap-3">
          {medications.map((m) => (
            <MedCard key={m.id} m={m} />
          ))}
        </div>
      </Modal>
    </div>
  );
}
