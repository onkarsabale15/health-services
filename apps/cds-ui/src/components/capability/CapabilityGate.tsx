'use client';

import { type ReactNode, useState } from 'react';
import type { ResourceCapabilities } from '@/lib/capabilities.types';

type Action = 'add' | 'edit' | 'delete';

interface Props {
  /** Capability envelope for the resource being gated. */
  capabilities: ResourceCapabilities | null | undefined;
  /** Which action this gate protects. */
  action: Action;
  /** Render mode when not allowed. `hide` removes the child; `disable` keeps it but greys it out with a tooltip. */
  fallback?: 'hide' | 'disable';
  children: ReactNode;
  /** Optional className applied to the wrapper. */
  className?: string;
}

/**
 * UX-only gate — the user should never see (or be able to click) an action
 * that the EHR doesn't support in their current launch mode. Pair every
 * Add / Edit / Delete button with this wrapper.
 *
 * Bridge will still reject the call if the gate is bypassed (e.g. via the
 * dev console). This component is not a security boundary.
 */
export function CapabilityGate({ capabilities, action, fallback = 'hide', children, className }: Props) {
  const [hovered, setHovered] = useState(false);
  const allowed = isAllowed(capabilities, action);
  const reason = capabilities?.reasons?.[action];

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback === 'hide') {
    return null;
  }

  // 'disable' fallback — render greyed-out child with hover tooltip showing reason
  return (
    <span
      className={`relative inline-flex opacity-50 pointer-events-none ${className ?? ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-disabled="true"
    >
      {children}
      {hovered && reason && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-normal max-w-xs bg-surface-on text-white text-xs px-3 py-2 rounded-lg shadow-floating text-center pointer-events-auto">
          {reason}
        </span>
      )}
    </span>
  );
}

function isAllowed(caps: ResourceCapabilities | null | undefined, action: Action): boolean {
  if (!caps) return false;
  switch (action) {
    case 'add':
      return caps.allowAdd;
    case 'edit':
      return caps.allowEdit;
    case 'delete':
      return caps.allowDelete;
  }
}
