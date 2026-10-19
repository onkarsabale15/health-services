/**
 * Provider role + derived capability flags.
 *
 * `role` is purely descriptive — what kind of provider this is. Useful for
 * audit logs, UI display, analytics. NOT used directly for gating (that's
 * what `ProviderCapabilities` is for).
 *
 * `ProviderCapabilities` are action-scoped flags computed FROM the role.
 * Today there's one — `canApproveCarePlan` — but as the product grows we
 * add named flags here per action: `canSignOrders`, `canCloseEncounter`,
 * `canPrescribeMedication`, etc. Each lives in one place server-side and
 * can encode state-level / supervision-agreement rules over time.
 *
 * Defaults are conservative — unknown roles bucket into `support`, with
 * no capabilities. A scribe should never silently get sign-off authority
 * because the EHR returned a qualification we didn't recognize.
 */
export type ProviderRole =
  | 'physician' // MD / DO
  | 'nurse_practitioner' // NP — full prescribing authority in most US states
  | 'physician_assistant' // PA — can sign within supervision agreement
  | 'nurse' // RN / LPN — clinical staff, no sign-off authority
  | 'medical_assistant' // MA / scribe / aide
  | 'support' // Catch-all for unknown roles; no clinical capabilities
  | 'system'; // Machine-to-machine integration (system mode)

export interface ProviderCapabilities {
  /**
   * Can transition a DRAFT care plan to ACTIVE — the "final submission"
   * action. Mirrors clinical sign-off authority in the US: prescribers
   * (physician, NP, PA) and trusted system integrations only.
   */
  canApproveCarePlan: boolean;
}

/** Map descriptive role → action-scoped capability flags. */
export function computeProviderCapabilities(role: ProviderRole): ProviderCapabilities {
  switch (role) {
    case 'physician':
    case 'nurse_practitioner':
    case 'physician_assistant':
    case 'system':
      return { canApproveCarePlan: true };
    case 'nurse':
    case 'medical_assistant':
    case 'support':
      return { canApproveCarePlan: false };
  }
}

// ── Inference from EHR-supplied role data ──────────────────────────────

/** Minimal FHIR shape we read — narrows the loose `Record<string, unknown>` from bridge. */
interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

interface FhirQualification {
  code?: FhirCodeableConcept;
}

/**
 * Display-string patterns mapped to descriptive roles. Order matters —
 * more specific patterns come first so "nurse practitioner" wins over
 * "nurse", "physician assistant" wins over "physician".
 *
 * Match is case-insensitive and substring-based — handles
 * "Doctor of Medicine (MD)", "Family Nurse Practitioner", etc.
 */
const ROLE_DISPLAY_PATTERNS: Array<{ pattern: RegExp; role: ProviderRole }> = [
  { pattern: /\bnurse\s+practitioner\b/i, role: 'nurse_practitioner' },
  { pattern: /\bphysician\s+assistant\b/i, role: 'physician_assistant' },
  { pattern: /\bcrna\b/i, role: 'nurse_practitioner' }, // certified registered nurse anesthetist — bucket as NP for canApprove parity
  { pattern: /\bcnm\b/i, role: 'nurse_practitioner' }, // certified nurse midwife
  { pattern: /\b(MD|DO)\b/, role: 'physician' }, // case-sensitive — "do" the verb is too common
  { pattern: /\bdoctor\s+of\s+(medicine|osteopath)/i, role: 'physician' },
  { pattern: /\bphysician\b/i, role: 'physician' },
  { pattern: /\bmedical\s+assistant\b/i, role: 'medical_assistant' },
  { pattern: /\bscribe\b/i, role: 'medical_assistant' },
  { pattern: /\b(cna|certified\s+nursing\s+assistant)\b/i, role: 'medical_assistant' },
  { pattern: /\bregistered\s+nurse\b/i, role: 'nurse' },
  { pattern: /\blicensed\s+practical\s+nurse\b/i, role: 'nurse' },
  { pattern: /\b(NP|PA|RN|LPN|MA)\b/, role: 'support' }, // bare initialisms are too ambiguous to map to a specific role
];

/**
 * SNOMED CT codes mapped to descriptive roles. Used as a fallback when
 * display strings are absent — many EHRs send only the code. Source:
 * https://browser.ihtsdotools.org/?perspective=full&edition=MAIN
 */
const ROLE_SNOMED_CODES: Record<string, ProviderRole> = {
  '309343006': 'physician', // Physician
  '158965000': 'physician', // Medical practitioner
  '309354003': 'physician', // General practitioner
  '309358004': 'physician', // Specialist physician
  '224570009': 'physician', // Specialist
  '224571008': 'nurse_practitioner', // Nurse practitioner
  '449161006': 'physician_assistant', // Physician assistant
  '224535009': 'nurse', // Registered nurse
};

function matchDisplayString(s: string): ProviderRole | null {
  for (const { pattern, role } of ROLE_DISPLAY_PATTERNS) {
    if (pattern.test(s)) return role;
  }
  return null;
}

/**
 * Map a free-form role hint (from `fhirContext[].role` on the JWE launch
 * token) to a descriptive role. Returns `null` when the hint doesn't
 * resolve so the caller can fall through to the next signal source.
 */
export function inferRoleFromFhirContextRole(role: string | undefined | null): ProviderRole | null {
  if (!role) return null;
  return matchDisplayString(role);
}

/**
 * Map a FHIR `Practitioner.qualification` array to a descriptive role.
 * Walks every qualification → every coding, prioritizing display-string
 * matches over SNOMED codes (displays are higher-fidelity in practice;
 * EHRs miscode roles surprisingly often).
 *
 * Returns the FIRST role that resolves to a prescriber-tier role
 * (physician, NP, PA) — those are the load-bearing answers. Otherwise
 * returns the most specific support-tier role found, or `null` when
 * nothing matches.
 */
export function inferRoleFromQualifications(qualifications: FhirQualification[] | undefined): ProviderRole | null {
  if (!qualifications || qualifications.length === 0) return null;

  const PRESCRIBER_ROLES: ProviderRole[] = ['physician', 'nurse_practitioner', 'physician_assistant'];
  let supportFallback: ProviderRole | null = null;

  for (const qual of qualifications) {
    const codings = qual.code?.coding ?? [];
    const text = qual.code?.text;

    // Display strings first — most reliable signal.
    const displays: string[] = [];
    if (text) displays.push(text);
    for (const c of codings) if (c.display) displays.push(c.display);

    for (const d of displays) {
      const role = matchDisplayString(d);
      if (!role) continue;
      if (PRESCRIBER_ROLES.includes(role)) return role;
      supportFallback = supportFallback ?? role;
    }

    // SNOMED codes — only consult if displays didn't yield anything.
    for (const c of codings) {
      if (!c.system?.includes('snomed') || !c.code) continue;
      const role = ROLE_SNOMED_CODES[c.code];
      if (!role) continue;
      if (PRESCRIBER_ROLES.includes(role)) return role;
      supportFallback = supportFallback ?? role;
    }
  }

  return supportFallback;
}

/**
 * Top-level role derivation for launch. Walks the signal sources in
 * priority order:
 *   1. JWE fhirContext role hint — set by the EHR's launch flow
 *   2. Practitioner.qualification — fetched from the bridge
 *
 * Returns `'support'` as the safe default when no signal resolves.
 */
export function deriveProviderRole(input: {
  fhirContextRole?: string | null;
  practitionerQualifications?: FhirQualification[];
}): ProviderRole {
  return (
    inferRoleFromFhirContextRole(input.fhirContextRole) ??
    inferRoleFromQualifications(input.practitionerQualifications) ??
    'support'
  );
}
