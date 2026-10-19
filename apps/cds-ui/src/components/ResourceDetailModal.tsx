'use client';

import { useState, type ReactNode } from 'react';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import { ItemDetailModal, type ItemField } from './ItemDetailModal';

interface ResourceDetailModalProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  loading: boolean;
  items: T[];
  /** Predicate that decides whether an item belongs in the Active section. */
  isActive: (item: T) => boolean;
  /** How each item renders in the list view (the small clickable row). */
  renderItem: (item: T) => ReactNode;
  /** Stable key extractor — used as React key and to memoize the selected item. */
  itemKey: (item: T) => string;
  /** Title shown in the per-item drill-down modal. */
  itemTitle: (item: T) => string;
  /** Field list for the per-item drill-down. */
  itemFields: (item: T) => ItemField[];
  /** Section labels — override when "Active / Inactive" doesn't fit (e.g. "All readings" for vitals). */
  activeLabel?: string;
  inactiveLabel?: string;
  emptyMessage?: string;
}

/**
 * Splits items into Active / Inactive sections by the caller-supplied
 * predicate and owns the per-item drill-down so every call site doesn't
 * have to thread that state itself.
 */
export function ResourceDetailModal<T>({
  open,
  onClose,
  title,
  loading,
  items,
  isActive,
  renderItem,
  itemKey,
  itemTitle,
  itemFields,
  activeLabel = 'Active',
  inactiveLabel = 'Inactive / resolved / past',
  emptyMessage = 'No items recorded',
}: ResourceDetailModalProps<T>) {
  const [selected, setSelected] = useState<T | null>(null);

  const active = items.filter((item) => isActive(item));
  const inactive = items.filter((item) => !isActive(item));

  return (
    <>
      <Modal open={open} onClose={onClose} title={title}>
        {loading && items.length === 0 ? (
          <div className="py-10">
            <LoadingSpinner />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <span className="material-symbols-outlined text-secondary/40" style={{ fontSize: 36 }}>
              inbox
            </span>
            <p className="text-sm text-secondary">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-5">
            <Section
              label={activeLabel}
              count={active.length}
              accent="bg-green-50 text-green-700"
              items={active}
              itemKey={itemKey}
              renderItem={renderItem}
              onItemClick={setSelected}
              emptyMessage="No active items"
            />
            {inactive.length > 0 && (
              <Section
                label={inactiveLabel}
                count={inactive.length}
                accent="bg-surface-container-low text-secondary"
                items={inactive}
                itemKey={itemKey}
                renderItem={renderItem}
                onItemClick={setSelected}
                emptyMessage="No inactive history"
              />
            )}
          </div>
        )}
      </Modal>

      <ItemDetailModal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? itemTitle(selected) : ''}
        fields={selected ? itemFields(selected) : []}
      />
    </>
  );
}

interface SectionProps<T> {
  label: string;
  count: number;
  accent: string;
  items: T[];
  itemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onItemClick: (item: T) => void;
  emptyMessage: string;
}

function Section<T>({ label, count, accent, items, itemKey, renderItem, onItemClick, emptyMessage }: SectionProps<T>) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary">{label}</h3>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${accent}`}>{count}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-secondary/60 italic px-1">{emptyMessage}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={itemKey(item)}>
              <button
                type="button"
                onClick={() => onItemClick(item)}
                className="w-full text-left p-3 rounded-lg bg-surface-container-low/40 hover:bg-surface-container-low focus:ring-2 focus:ring-primary/40 focus:outline-none transition-colors"
              >
                {renderItem(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
