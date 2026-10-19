'use client';

/**
 * Lightweight shimmer block used as a loading placeholder.
 *
 * Pairs with the `animate-shimmer` keyframe defined in tailwind.config.ts.
 * Use it in place of spinners on first paint so the layout doesn't reflow
 * when real data arrives — clinicians see the same shape settle in instead
 * of an empty card jumping into existence.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-[linear-gradient(90deg,#eef2f7_0%,#f5f8fc_50%,#eef2f7_100%)] bg-[length:200%_100%] animate-shimmer rounded-md ${className}`}
      aria-hidden="true"
    />
  );
}

/** Common skeleton shapes used throughout the patient view. */
export function SkeletonRow({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg bg-surface-container-low/40 ${className}`}>
      <Skeleton className="w-1 h-12 shrink-0" />
      <div className="flex-1 space-y-1.5 py-0.5">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-2.5 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonTile({ className = '' }: { className?: string }) {
  return (
    <div className={`p-3 rounded-lg bg-surface-container-low/40 space-y-2 ${className}`}>
      <Skeleton className="h-2.5 w-1/2" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-2 w-1/3" />
    </div>
  );
}
