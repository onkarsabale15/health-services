'use client';

import type { ReactNode } from 'react';
import Modal from './Modal';

export interface ItemField {
  label: string;
  /** Pre-rendered value — strings, numbers, badges, etc. Anything React. */
  value: ReactNode;
}

interface ItemDetailModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: ItemField[];
}

/**
 * Drops falsy values so callers can build the field list with optional
 * fields and not branch on each one.
 */
export function ItemDetailModal({ open, onClose, title, fields }: ItemDetailModalProps) {
  const visible = fields.filter((f) => isMeaningful(f.value));
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {visible.length === 0 ? (
        <p className="text-sm text-secondary text-center py-6">No additional details available.</p>
      ) : (
        <dl className="space-y-3">
          {visible.map((field) => (
            <div key={field.label} className="grid grid-cols-[140px_1fr] gap-3 items-baseline">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-secondary/80">{field.label}</dt>
              <dd className="text-sm text-surface-on">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Modal>
  );
}

function isMeaningful(v: ReactNode): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}
