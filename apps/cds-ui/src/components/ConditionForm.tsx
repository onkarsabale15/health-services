'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cdsApi } from '@/lib/api';
import type {
  ConditionRequest,
  ConditionSeverityLevel,
  ConditionSummary,
  FhirResourceResult,
  TerminologyConceptWithMappings,
} from '@/types';
import {
  CONDITION_STATE_OPTIONS,
  getConditionStateOption,
  isAbatementState,
  type ConditionStateValue,
} from '@/lib/condition-states';
import TerminologySearchField from './TerminologySearchField';
import ChangedBadge from './ChangedBadge';
import { CategorySelector } from './capability/CategorySelector';
import type {
  ConditionCategory,
  ConditionWriteField,
  ConditionWriteRules,
  ResourceCapabilities,
} from '@/lib/capabilities.types';

// ─── ConditionForm ───────────────────────────────────────────────────────────
//
// Provider-friendly create / update form for a Condition.
//
// This form collects a LEAN request shape and hands it to cds-app — the
// backend assembles the full FHIR Condition body. The form never touches
// FHIR URIs, HL7 code values, or resource-type strings.
//
// Knowledge split:
//   Frontend (this file + lib/condition-states.ts)
//     → UI state model: plain-English options, labels, icons, colors
//     → Form state: selected concept, chosen state value, severity, dates, note
//
//   Backend (cds-app/modules/clinical-write)
//     → ConditionBodyBuilder assembles FHIR Condition from the lean request
//     → constants/fhir-codings.ts owns SYSTEM URIs + severity SNOMED codes
//     → constants/condition-state.model.ts owns state → (clinical, verification)
//       mapping
//
// Adding a new field: add it to `ConditionRequest` in types/index.ts AND in
// `ConditionRequestDto` in cds-app, then teach `ConditionBodyBuilder` how
// to map it. The form only needs the input control.

// ─── Props ───────────────────────────────────────────────────────────────────

type CreateProps = {
  mode: 'create';
  existing?: undefined;
  /**
   * Per-resource capabilities from the conditions list response. Drives the
   * category picker. The form is only opened after the parent has loaded the
   * conditions list, so this is always defined at mount.
   */
  capabilities: ResourceCapabilities;
  onSaved: (result: FhirResourceResult) => void;
  onCancel: () => void;
};

type UpdateProps = {
  mode: 'update';
  existing: ConditionSummary;
  capabilities: ResourceCapabilities;
  onSaved: (result: FhirResourceResult) => void;
  onCancel: () => void;
};

type Props = CreateProps | UpdateProps;

// ─── Severity options (UI presentation only) ───────────────────────────────

const SEVERITY_BUTTONS: Array<{ value: ConditionSeverityLevel; label: string }> = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
];

/** Build a `TerminologyConceptWithMappings` placeholder from a stored summary
 *  so the locked code-field in update mode has something to render. */
/** Narrow `ConditionSummary.category` (loose string from BE) to the typed enum. */
function coerceCategory(category: string | undefined): ConditionCategory | undefined {
  if (category === 'problem-list-item' || category === 'encounter-diagnosis' || category === 'health-concern') {
    return category;
  }
  return undefined;
}

function conceptFromConditionSummary(summary: ConditionSummary): TerminologyConceptWithMappings {
  const system = summary.codeSystem?.includes('snomed') ? 'snomed' : 'icd10';
  return {
    system,
    systemUri: summary.codeSystem ?? '',
    code: summary.icdCode,
    display: summary.name,
    mappings: [],
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ConditionForm(props: Props) {
  const isUpdate = props.mode === 'update';
  const existing = isUpdate ? props.existing : null;
  const rules = props.capabilities.writeRules;

  // Form state — primitive, derived at save time via buildConditionBody.
  const [concept, setConcept] = useState<TerminologyConceptWithMappings | null>(
    existing ? conceptFromConditionSummary(existing) : null,
  );
  const [state, setState] = useState<ConditionStateValue>(existing?.stateValue ?? 'active-confirmed');
  const [severity, setSeverity] = useState<ConditionSeverityLevel | ''>(existing?.severityLevel ?? '');
  const [abatementDate, setAbatementDate] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDestructive, setConfirmingDestructive] = useState(false);
  // Synchronous double-submit guard — `submitting` state isn't visible to
  // a second click in the same React tick before the re-render flushes,
  // and the `confirmingDestructive` confirm flow makes the gap exploitable
  // (rapid double-click could fire two saves). The ref flips immediately.
  const submittingRef = useRef(false);

  // Category is driven by the capability matrix — Epic exposes only
  // 'encounter-diagnosis', Cerner exposes both, DrChrono only 'problem-list-item'.
  // Update mode preserves the existing Condition's category (the
  // CategorySelector renders read-only); create mode auto-selects from
  // allowed when none picked. Don't fall back to allowedCategories[0] in
  // update mode — that would silently mutate the category away from
  // whatever the existing record carries (including categories like
  // 'health-concern' that aren't in the EHR's current allowed list).
  const allowedCategories = props.capabilities.categories ?? null;
  const [category, setCategory] = useState<ConditionCategory | undefined>(() =>
    existing ? coerceCategory(existing.category) : undefined,
  );
  useEffect(() => {
    if (isUpdate) return;
    if (!category && allowedCategories && allowedCategories.length > 0) {
      setCategory(allowedCategories[0]);
    }
  }, [allowedCategories, category, isUpdate]);

  // ── Rule-driven flags (capability-driven UI gating) ───────────────────
  //
  // Centralizes the per-EHR Condition write rules into one place. The form
  // never branches on EHR name or hardcoded category strings — all rendering
  // decisions read from the `capabilities.writeRules` envelope returned by
  // the backend.

  const forbiddenFields = useMemo(() => buildForbiddenFields(rules, category, isUpdate), [rules, category, isUpdate]);
  const immutableFields = useMemo(() => new Set<ConditionWriteField>(rules?.update.immutableFields ?? []), [rules]);
  const allowedStates = useMemo(() => buildAllowedStates(rules, category, isUpdate), [rules, category, isUpdate]);

  const categoryReadOnly = isUpdate && immutableFields.has('category');
  const codeReadOnly = isUpdate && immutableFields.has('code');
  const isFieldEditable = (field: ConditionWriteField): boolean =>
    !forbiddenFields.has(field) && !immutableFields.has(field);
  const showSeverity = isFieldEditable('severity');
  const showAbatementField = isFieldEditable('abatementDate');
  const showNoteEditor = isUpdate
    ? isFieldEditable('note')
    : (rules?.create.notesAccepted ?? true) && !forbiddenFields.has('note');

  // Keep the form coherent when category changes (create flow): if the
  // current state isn't allowed for the new category, drop to the first
  // allowed; clear values for any field the new category forbids.
  useEffect(() => {
    if (allowedStates && !allowedStates.has(state)) {
      const next = CONDITION_STATE_OPTIONS.find((o) => allowedStates.has(o.value));
      if (next) setState(next.value);
    }
    if (!showAbatementField && abatementDate) setAbatementDate('');
    if (!showSeverity && severity) setSeverity('');
  }, [allowedStates, state, showAbatementField, abatementDate, showSeverity, severity]);

  // Snapshot original so we can highlight diffs in update mode.
  const original = useMemo(() => {
    if (!existing) return null;
    return {
      state: existing.stateValue,
      severity: existing.severity ?? '',
    };
  }, [existing]);

  const selectedOption = useMemo(() => getConditionStateOption(state), [state]);

  // ── Event handlers ─────────────────────────────────────────────────────

  const handleStateChange = (next: ConditionStateValue) => {
    setState(next);
    const opt = getConditionStateOption(next);

    // When state implies resolution, default abatement to today.
    // Leaving the field empty keeps the original behaviour (no change).
    if (isAbatementState(next) && !abatementDate) {
      setAbatementDate(todayIsoDate());
    }
    if (!isAbatementState(next)) {
      setAbatementDate('');
    }

    // Reset destructive confirmation if they switch away.
    if (!opt.destructive) setConfirmingDestructive(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!concept) {
      setSubmitError('Please select a diagnosis code.');
      return;
    }
    // Defensive date validation — browsers generally enforce max on
    // <input type="date">, but a pasted value or scripted form state
    // can still end up out-of-bounds. Catch it before we hit the EHR.
    if (abatementDate && abatementDate > todayIsoDate()) {
      setSubmitError('Resolution date cannot be in the future.');
      return;
    }
    if (selectedOption.destructive && !confirmingDestructive) {
      setConfirmingDestructive(true);
      return;
    }

    // Synchronous re-entry guard — see submittingRef declaration.
    if (submittingRef.current) return;
    submittingRef.current = true;

    setSubmitting(true);
    try {
      const request: ConditionRequest = {
        concept,
        state,
        category,
        severity: severity || undefined,
        abatementDate: abatementDate || undefined,
        note: note.trim() || undefined,
      };

      const result = isUpdate
        ? await cdsApi.updateCondition(existing!.id, request)
        : await cdsApi.createCondition(request);

      props.onSaved(result);
    } catch (err: unknown) {
      setSubmitError((err as Error)?.message ?? 'Failed to save the condition');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setConfirmingDestructive(false);
    }
  };

  // Derived flags for change highlighting.
  const stateChanged = Boolean(original && original.state !== state);
  const severityChanged = Boolean(original && original.severity !== severity);

  // Date bounds — abatement cannot be in the future. Enforced via input max.
  const today = todayIsoDate();

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <TerminologySearchField
        system="snomed"
        label="Diagnosis"
        value={concept}
        onChange={setConcept}
        disabled={codeReadOnly}
        required
        hint={
          codeReadOnly
            ? undefined
            : 'Search by description (e.g. "diabetes") or code. Picking a SNOMED concept automatically includes its ICD-10 mapping.'
        }
      />

      <CategorySelector
        options={allowedCategories}
        value={category}
        onChange={setCategory}
        label="Category"
        required
        readOnly={categoryReadOnly}
      />

      <StatePicker value={state} onChange={handleStateChange} changed={stateChanged} allowedStates={allowedStates} />

      {showSeverity && <SeverityPicker value={severity} onChange={setSeverity} changed={severityChanged} />}

      <AnimatePresence>
        {showAbatementField && isAbatementState(state) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <DateField
              label={selectedOption.clinical === 'resolved' ? 'Resolved on' : 'Remission since'}
              value={abatementDate}
              onChange={setAbatementDate}
              max={today}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <NoteField value={note} onChange={setNote} showEditor={showNoteEditor} existingNotes={existing?.notes} />

      <AnimatePresence>
        {confirmingDestructive && selectedOption.destructive && <DestructiveConfirmBanner />}
      </AnimatePresence>

      {submitError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs text-red-700">{submitError}</p>
        </div>
      )}

      <FormActions
        mode={props.mode}
        destructive={Boolean(selectedOption.destructive)}
        confirming={confirmingDestructive}
        submitting={submitting}
        canSubmit={Boolean(concept)}
        onCancel={props.onCancel}
      />
    </form>
  );
}

// ─── Sub-components (presentation only) ──────────────────────────────────────

function StatePicker({
  value,
  onChange,
  changed,
  allowedStates,
}: {
  value: ConditionStateValue;
  onChange: (next: ConditionStateValue) => void;
  changed: boolean;
  allowedStates: ReadonlySet<ConditionStateValue> | null;
}) {
  const visibleOptions = allowedStates
    ? CONDITION_STATE_OPTIONS.filter((opt) => allowedStates.has(opt.value))
    : CONDITION_STATE_OPTIONS;
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-surface-on/80 flex items-center gap-1">
        State {changed && <ChangedBadge />}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visibleOptions.map((opt) => {
          const Icon = opt.icon;
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={`group text-left rounded-xl border-2 px-3 py-2.5 transition-all ${
                active
                  ? `${opt.color} border-current shadow-sm`
                  : 'border-surface-container-high/40 bg-white hover:border-surface-container-high'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon size={14} className="shrink-0" />
                <span className="text-xs font-semibold">{opt.label}</span>
              </div>
              <p className="text-[11px] text-secondary mt-0.5 leading-snug">{opt.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SeverityPicker({
  value,
  onChange,
  changed,
}: {
  value: ConditionSeverityLevel | '';
  onChange: (next: ConditionSeverityLevel | '') => void;
  changed: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-surface-on/80 flex items-center gap-1">
        Severity <span className="text-secondary">(optional)</span>
        {changed && <ChangedBadge />}
      </label>
      <div className="flex gap-1">
        <PickerButton active={value === ''} onClick={() => onChange('')}>
          None
        </PickerButton>
        {SEVERITY_BUTTONS.map((s) => (
          <PickerButton key={s.value} active={value === s.value} onClick={() => onChange(s.value)}>
            {s.label}
          </PickerButton>
        ))}
      </div>
    </div>
  );
}

function PickerButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-xs px-3 py-2 rounded-lg border transition ${
        active
          ? 'border-primary bg-primary-container/40 text-primary'
          : 'border-surface-container-high/40 bg-white text-secondary hover:bg-surface-container-low'
      }`}
    >
      {children}
    </button>
  );
}

function DateField({
  label,
  value,
  onChange,
  optional = false,
  changed = false,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  optional?: boolean;
  changed?: boolean;
  min?: string;
  max?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-surface-on/80 flex items-center gap-1">
        {label} {optional && <span className="text-secondary">(optional)</span>}
        {changed && <ChangedBadge />}
      </label>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="w-full sm:w-48 text-sm px-3 py-2 rounded-lg border border-surface-container-high/40 bg-white text-surface-on focus:border-primary/60 outline-none"
      />
    </div>
  );
}

function NoteField({
  value,
  onChange,
  showEditor,
  existingNotes,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Driven by `capabilities.writeRules` — false when the EHR rejects new notes for the current operation. */
  showEditor: boolean;
  existingNotes?: string[];
}) {
  const hasExisting = !!existingNotes && existingNotes.length > 0;
  if (!showEditor && !hasExisting) return null;
  return (
    <div className="space-y-3">
      {hasExisting && (
        <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>
              note
            </span>
            <h4 className="text-sm font-semibold text-surface-on">
              Note history
              <span className="ml-1.5 text-xs font-normal text-secondary">({existingNotes!.length})</span>
            </h4>
          </div>
          <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {existingNotes!.map((n, i) => (
              <li key={i} className="flex gap-2 text-sm text-surface-on/90 leading-relaxed">
                <span className="shrink-0 text-secondary/60 font-mono text-xs pt-[2px]">{i + 1}.</span>
                <span className="whitespace-pre-wrap break-words">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {showEditor && (
        <>
          <label className="text-xs font-medium text-surface-on/80">Clinical note</label>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Context or rationale for this diagnosis (optional)."
            className="w-full text-sm px-3 py-2 rounded-lg border border-surface-container-high/40 bg-white text-surface-on focus:border-primary/60 outline-none resize-none"
          />
        </>
      )}
    </div>
  );
}

function DestructiveConfirmBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-700">Flag this condition as entered in error?</p>
          <p className="text-xs text-red-600 mt-1">
            This preserves the audit trail — the condition is NOT deleted. Click Save again to confirm.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function FormActions({
  mode,
  destructive,
  confirming,
  submitting,
  canSubmit,
  onCancel,
}: {
  mode: 'create' | 'update';
  destructive: boolean;
  confirming: boolean;
  submitting: boolean;
  canSubmit: boolean;
  onCancel: () => void;
}) {
  const buttonLabel = destructive
    ? confirming
      ? 'Confirm flag as error'
      : 'Flag as error'
    : mode === 'update'
      ? 'Save changes'
      : 'Add condition';

  return (
    <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high/30">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 rounded-lg text-sm text-secondary hover:bg-surface-container-low"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={submitting || !canSubmit}
        className={`px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 ${
          destructive
            ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
            : 'bg-primary hover:bg-primary/90 disabled:bg-primary/40'
        } disabled:cursor-not-allowed`}
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        {buttonLabel}
      </button>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the forbidden-fields set for the active operation + category by
 * merging the rule's top-level `forbiddenFields` with any per-category
 * tightening. The form never has to know which EHR enforces which rule.
 */
function buildForbiddenFields(
  rules: ConditionWriteRules | undefined,
  category: ConditionCategory | undefined,
  isUpdate: boolean,
): Set<ConditionWriteField> {
  if (!rules) return new Set();
  const branch = isUpdate ? rules.update : rules.create;
  const merged = new Set<ConditionWriteField>(branch.forbiddenFields ?? []);
  if (category) {
    for (const f of branch.perCategory?.[category]?.forbiddenFields ?? []) merged.add(f);
  }
  return merged;
}

/**
 * Allowed states for the active operation + category. Returns `null` (no
 * filter) when the form is in update mode — most EHRs allow any state on PUT
 * (refuted, entered-in-error) so the picker shows the full set. Create-mode
 * filters by `rules.create.perCategory[category].allowedStates ??
 * rules.create.allowedStates`.
 */
function buildAllowedStates(
  rules: ConditionWriteRules | undefined,
  category: ConditionCategory | undefined,
  isUpdate: boolean,
): ReadonlySet<ConditionStateValue> | null {
  if (!rules) return null;
  if (isUpdate) {
    // Update may have its own (usually stricter) state list. Falls back to
    // create's list when the EHR didn't declare an update-specific one.
    const perCat = category ? rules.update.perCategory?.[category]?.allowedStates : undefined;
    const allowed = perCat ?? rules.update.allowedStates ?? rules.create.allowedStates;
    return new Set(allowed);
  }
  if (!category) return new Set(rules.create.allowedStates);
  const allowed = rules.create.perCategory?.[category]?.allowedStates ?? rules.create.allowedStates;
  return new Set(allowed);
}

function todayIsoDate(): string {
  // Build YYYY-MM-DD from local components — `new Date().toISOString()`
  // returns UTC, which produces an off-by-one in PST evenings (UTC has
  // already rolled into tomorrow).
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
