'use client';

import type { ConditionCategory } from '@/lib/capabilities.types';

interface Props {
  /** Allowed categories for the current EHR + mode. From `capabilities.categories`. */
  options: ConditionCategory[] | null | undefined;
  value: ConditionCategory | undefined;
  onChange: (value: ConditionCategory) => void;
  label?: string;
  required?: boolean;
  /**
   * Display the category as a static label rather than an editable picker.
   * Use in update flows — a Condition's category (problem-list-item vs
   * encounter-diagnosis) is its identity marker; switching it via Edit
   * doesn't reflect a real clinical workflow. Record a new Condition
   * instead.
   */
  readOnly?: boolean;
}

const LABELS: Record<ConditionCategory, string> = {
  'problem-list-item': 'Problem List',
  'encounter-diagnosis': 'Encounter Diagnosis',
  'health-concern': 'Health Concern',
};

/**
 * Renders a category picker only when the EHR supports more than one option.
 * If the EHR has a single allowed category, auto-selects it and renders nothing.
 * If the EHR allows none (Meditech), renders nothing — the parent form should
 * itself be hidden via `CapabilityGate`.
 */
export function CategorySelector({ options, value, onChange, label = 'Category', required, readOnly }: Props) {
  // No options at all (read-only EHR) — host form should be gated; render nothing here.
  if (!options || options.length === 0) return null;

  // Read-only: render the current value as a static labeled chip (only when
  // we have a value to show — avoids an empty placeholder on initial load).
  if (readOnly) {
    if (!value) return null;
    return (
      <label className="block text-sm">
        <span className="text-secondary mb-1 block">{label}</span>
        <span className="inline-block px-3 py-2 rounded-md bg-surface-container-low/40 text-surface-on">
          {LABELS[value] ?? value}
        </span>
      </label>
    );
  }

  // Single option — auto-select silently and render nothing.
  if (options.length === 1) {
    if (value !== options[0]) onChange(options[0]);
    return null;
  }

  return (
    <label className="block text-sm">
      <span className="text-secondary mb-1 block">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <select
        className="w-full border border-surface-container-high rounded-md px-3 py-2 bg-white"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value as ConditionCategory)}
        required={required}
      >
        <option value="" disabled>
          Select category…
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {LABELS[opt] ?? opt}
          </option>
        ))}
      </select>
    </label>
  );
}
