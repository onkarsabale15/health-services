'use client';

import { useRouter } from 'next/navigation';
import type { CarePlan, CdsCard } from '@/types';
import { STATUS_BADGE } from '@/lib/cds-constants';

interface CarePlansTableProps {
  carePlans: CarePlan[];
  showPatient?: boolean;
  emptyMessage?: string;
  emptySubtext?: string;
}

export default function CarePlansTable({
  carePlans,
  showPatient = false,
  emptyMessage = 'No care plans yet.',
  emptySubtext,
}: CarePlansTableProps) {
  const router = useRouter();

  if (!carePlans.length) {
    return (
      <div className="cds-card p-8 text-center">
        <span className="material-symbols-outlined text-secondary mb-2" style={{ fontSize: 40 }}>
          description
        </span>
        <p className="text-secondary text-sm">{emptyMessage}</p>
        {emptySubtext && <p className="text-xs text-secondary/60 mt-1">{emptySubtext}</p>}
      </div>
    );
  }

  return (
    <div className="cds-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-container-low">
            <th className="text-left p-3 font-semibold text-secondary">Title</th>
            {showPatient && <th className="text-left p-3 font-semibold text-secondary">Patient</th>}
            <th className="text-left p-3 font-semibold text-secondary">Encounter</th>
            <th className="text-left p-3 font-semibold text-secondary">Status</th>
            <th className="text-left p-3 font-semibold text-secondary">Date</th>
            <th className="text-left p-3 font-semibold text-secondary">Provider</th>
            <th className="text-right p-3 font-semibold text-secondary">Cards</th>
          </tr>
        </thead>
        <tbody>
          {carePlans.map((plan) => (
            <tr
              key={plan.id}
              className="hover:bg-surface-container-low/50 cursor-pointer transition-colors"
              onClick={() => router.push(`/app/history/${plan.id}`)}
            >
              <td className="p-3 font-medium text-surface-on">
                <div className="flex items-center gap-1.5">
                  {plan.title}
                  {plan.version > 1 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      v{plan.version}
                    </span>
                  )}
                </div>
              </td>
              {showPatient && <td className="p-3 text-secondary">{plan.patientName ?? plan.patientFhirId}</td>}
              <td className="p-3 text-secondary">
                {plan.encounterType || '\u2014'}
                {plan.encounterDate && (
                  <span className="text-xs ml-1">({new Date(plan.encounterDate).toLocaleDateString()})</span>
                )}
              </td>
              <td className="p-3">
                <span className={`badge ${STATUS_BADGE[plan.status] ?? ''}`}>{plan.status}</span>
              </td>
              <td className="p-3 text-secondary">{new Date(plan.createdAt).toLocaleDateString()}</td>
              <td className="p-3 text-secondary">{plan.providerName ?? '\u2014'}</td>
              <td className="p-3 text-right text-secondary">{(plan.cards as CdsCard[]).length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
