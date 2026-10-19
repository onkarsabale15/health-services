'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';
import { SkeletonRow, SkeletonTile } from './Skeleton';

interface ClinicalSectionCardProps<T> {
  icon: string;
  title: ReactNode;
  /** Pass `items?.length ?? null` — null means loading, number means render in parens. */
  count: number | null;
  /** Optional header-row action (Add button, etc.). Sits at `ml-auto`. */
  action?: ReactNode;
  /** True until the parent's data hook resolves at least once. Drives the skeleton. */
  loading: boolean;
  /** null = loading; [] = empty; otherwise rendered through renderItem. */
  items: T[] | null;
  layout: 'list' | 'tile';
  emptyIcon: string;
  emptyMessage: string;
  itemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Optional click handler — when present, each row becomes a button with focus styles. */
  onItemClick?: (item: T) => void;
  /** Required when `onItemClick` is set, for accessible button labels. */
  itemAriaLabel?: (item: T) => string;
  onViewAll: () => void;
  viewAllLabel?: string;
}

/**
 * Header + content + view-all footer scaffold for the Clinical Summary
 * 2x2 grid. Encapsulates the skeleton / empty / list dance so the four
 * grid cards stop being copies of each other.
 */
export function ClinicalSectionCard<T>({
  icon,
  title,
  count,
  action,
  loading,
  items,
  layout,
  emptyIcon,
  emptyMessage,
  itemKey,
  renderItem,
  onItemClick,
  itemAriaLabel,
  onViewAll,
  viewAllLabel = 'View all',
}: ClinicalSectionCardProps<T>) {
  const showSkeleton = loading && (items === null || items.length === 0);
  const showEmpty = !showSkeleton && (items === null || items.length === 0);

  return (
    <motion.div variants={fadeInUp} className="cds-card p-5">
      <div className="cds-section-header">
        <span className="material-symbols-outlined icon">{icon}</span>
        <h3>
          {title}
          {count !== null && <span className="font-normal text-secondary/60 ml-1">({count})</span>}
        </h3>
        {action && <div className="ml-auto">{action}</div>}
      </div>

      {showSkeleton ? (
        <Skeletons layout={layout} />
      ) : showEmpty ? (
        <EmptyState icon={emptyIcon} message={emptyMessage} />
      ) : (
        <>
          <div className={containerClass(layout)}>
            {items!.map((item, i) => (
              <ItemSlot
                key={itemKey(item)}
                index={i}
                layout={layout}
                onClick={onItemClick ? () => onItemClick(item) : undefined}
                ariaLabel={itemAriaLabel?.(item)}
              >
                {renderItem(item)}
              </ItemSlot>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs text-primary hover:underline focus:underline focus:outline-none flex items-center gap-1"
            >
              {viewAllLabel}
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                chevron_right
              </span>
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── Internals ───────────────────────────────────────────────────────────

interface ItemSlotProps {
  index: number;
  layout: 'list' | 'tile';
  onClick?: () => void;
  ariaLabel?: string;
  children: ReactNode;
}

function ItemSlot({ index, layout, onClick, ariaLabel, children }: ItemSlotProps) {
  const motionProps = motionFor(layout, index);

  // List rows with a click handler render as a real <button> so keyboard
  // focus + activation Just Work. Everything else (tiles, non-clickable
  // list rows) is a plain div with the same motion entrance.
  if (layout === 'list' && onClick) {
    return (
      <motion.button
        type="button"
        {...motionProps}
        onClick={onClick}
        aria-label={ariaLabel}
        className="w-full text-left px-3 py-2 rounded-lg bg-surface-container-low/40 hover:bg-surface-container-low focus:ring-2 focus:ring-primary/40 focus:outline-none transition-colors"
      >
        {children}
      </motion.button>
    );
  }

  return (
    <motion.div {...motionProps} className={layout === 'tile' ? 'vital-tile' : staticListRowClass}>
      {children}
    </motion.div>
  );
}

const staticListRowClass =
  'px-3 py-2 rounded-lg bg-surface-container-low/40 hover:bg-surface-container-low transition-colors';

/** Entrance animation per layout: list rows slide in, tiles scale in. */
function motionFor(layout: 'list' | 'tile', index: number) {
  if (layout === 'tile') {
    return {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1 },
      transition: { delay: index * 0.04 },
    };
  }
  return {
    initial: { opacity: 0, x: -8 },
    animate: { opacity: 1, x: 0 },
    transition: { delay: index * 0.03 },
  };
}

function containerClass(layout: 'list' | 'tile'): string {
  return layout === 'list' ? 'space-y-2 max-h-80 overflow-y-auto' : 'grid grid-cols-2 gap-2 max-h-80 overflow-y-auto';
}

function Skeletons({ layout }: { layout: 'list' | 'tile' }) {
  if (layout === 'tile') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonTile key={i} />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="text-center py-6">
      <span className="material-symbols-outlined text-secondary/30" style={{ fontSize: 32 }}>
        {icon}
      </span>
      <p className="text-xs text-secondary mt-1">{message}</p>
    </div>
  );
}
