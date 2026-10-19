import {
  computeProviderCapabilities,
  deriveProviderRole,
  inferRoleFromFhirContextRole,
  inferRoleFromQualifications,
} from './provider-role';

/**
 * Tests for the role inference helpers + capability mapping.
 *
 * Two layers of behavior to lock down:
 *   1. Inference — messy EHR-supplied data → descriptive role
 *   2. Capability — descriptive role → action-scoped flags (today only
 *      `canApproveCarePlan`)
 *
 * The split lets a future contributor reuse the role for UI display,
 * audit, or analytics without invoking gating logic.
 */

describe('inferRoleFromFhirContextRole', () => {
  it('returns physician for MD/DO hints', () => {
    expect(inferRoleFromFhirContextRole('Doctor of Medicine')).toBe('physician');
    expect(inferRoleFromFhirContextRole('MD')).toBe('physician');
    expect(inferRoleFromFhirContextRole('Doctor of Osteopathic Medicine')).toBe('physician');
    expect(inferRoleFromFhirContextRole('Physician')).toBe('physician');
  });

  it('returns nurse_practitioner for NP hints', () => {
    expect(inferRoleFromFhirContextRole('Nurse Practitioner')).toBe('nurse_practitioner');
    expect(inferRoleFromFhirContextRole('Family Nurse Practitioner')).toBe('nurse_practitioner');
  });

  it('returns physician_assistant for PA hints', () => {
    expect(inferRoleFromFhirContextRole('Physician Assistant')).toBe('physician_assistant');
  });

  it('returns nurse for RN/LPN hints', () => {
    expect(inferRoleFromFhirContextRole('Registered Nurse')).toBe('nurse');
    expect(inferRoleFromFhirContextRole('Licensed Practical Nurse')).toBe('nurse');
  });

  it('returns medical_assistant for MA / scribe / CNA hints', () => {
    expect(inferRoleFromFhirContextRole('Medical Assistant')).toBe('medical_assistant');
    expect(inferRoleFromFhirContextRole('Scribe')).toBe('medical_assistant');
    expect(inferRoleFromFhirContextRole('Certified Nursing Assistant')).toBe('medical_assistant');
  });

  it('returns null for unknown / missing hints so caller can fall through', () => {
    expect(inferRoleFromFhirContextRole(undefined)).toBeNull();
    expect(inferRoleFromFhirContextRole('')).toBeNull();
    expect(inferRoleFromFhirContextRole('Some Custom Cerner Role')).toBeNull();
  });
});

describe('inferRoleFromQualifications', () => {
  it('matches physician via qualification display string', () => {
    const role = inferRoleFromQualifications([{ code: { coding: [{ display: 'Doctor of Medicine (MD)' }] } }]);
    expect(role).toBe('physician');
  });

  it('matches physician via SNOMED code when display is absent', () => {
    const role = inferRoleFromQualifications([
      { code: { coding: [{ system: 'http://snomed.info/sct', code: '309343006' }] } },
    ]);
    expect(role).toBe('physician');
  });

  it('matches nurse_practitioner via NP SNOMED code', () => {
    const role = inferRoleFromQualifications([
      { code: { coding: [{ system: 'http://snomed.info/sct', code: '224571008' }] } },
    ]);
    expect(role).toBe('nurse_practitioner');
  });

  it('matches nurse for RN qualification (display) — overrides SNOMED ambiguity', () => {
    const role = inferRoleFromQualifications([
      {
        code: {
          coding: [{ system: 'http://snomed.info/sct', code: '224535009', display: 'Registered Nurse' }],
        },
      },
    ]);
    expect(role).toBe('nurse');
  });

  it('matches NP when an NP display sits alongside an RN code on the same person', () => {
    // EHRs sometimes layer codings on a single qualification — NP-leaning
    // display + ambiguous RN SNOMED code. The display wins.
    const role = inferRoleFromQualifications([
      {
        code: {
          coding: [{ system: 'http://snomed.info/sct', code: '224535009' }, { display: 'Family Nurse Practitioner' }],
        },
      },
    ]);
    expect(role).toBe('nurse_practitioner');
  });

  it('uses qualification.text as a fallback display source', () => {
    const role = inferRoleFromQualifications([{ code: { text: 'Doctor of Osteopathic Medicine' } }]);
    expect(role).toBe('physician');
  });

  it('returns the first prescriber-tier match across multiple entries', () => {
    const role = inferRoleFromQualifications([
      { code: { coding: [{ display: 'Bachelor of Science' }] } }, // no match
      { code: { coding: [{ display: 'Medical Doctor (MD)' }] } },
    ]);
    expect(role).toBe('physician');
  });

  it('returns null when nothing matches', () => {
    expect(inferRoleFromQualifications(undefined)).toBeNull();
    expect(inferRoleFromQualifications([])).toBeNull();
    expect(inferRoleFromQualifications([{ code: { coding: [{ display: 'Bachelor of Science' }] } }])).toBeNull();
  });

  it('returns medical_assistant when only an MA-leaning display matches', () => {
    const role = inferRoleFromQualifications([{ code: { coding: [{ display: 'Medical Assistant' }] } }]);
    expect(role).toBe('medical_assistant');
  });
});

describe('deriveProviderRole', () => {
  it('prefers the fhirContext role hint when present', () => {
    const role = deriveProviderRole({
      fhirContextRole: 'Physician',
      practitionerQualifications: [{ code: { coding: [{ display: 'Registered Nurse' }] } }],
    });
    expect(role).toBe('physician');
  });

  it('falls back to qualifications when fhirContext role is missing', () => {
    const role = deriveProviderRole({
      fhirContextRole: undefined,
      practitionerQualifications: [{ code: { coding: [{ display: 'Doctor of Medicine' }] } }],
    });
    expect(role).toBe('physician');
  });

  it('falls back to qualifications when fhirContext role is unrecognized', () => {
    const role = deriveProviderRole({
      fhirContextRole: 'cerner.proprietary.role.code',
      practitionerQualifications: [{ code: { coding: [{ display: 'Nurse Practitioner' }] } }],
    });
    expect(role).toBe('nurse_practitioner');
  });

  it('defaults to support when no signal resolves — closed by default', () => {
    expect(deriveProviderRole({})).toBe('support');
    expect(deriveProviderRole({ fhirContextRole: 'unknown', practitionerQualifications: [] })).toBe('support');
  });
});

describe('computeProviderCapabilities', () => {
  it('grants canApproveCarePlan to prescriber-tier roles', () => {
    expect(computeProviderCapabilities('physician').canApproveCarePlan).toBe(true);
    expect(computeProviderCapabilities('nurse_practitioner').canApproveCarePlan).toBe(true);
    expect(computeProviderCapabilities('physician_assistant').canApproveCarePlan).toBe(true);
  });

  it('grants canApproveCarePlan to system-mode integrations', () => {
    expect(computeProviderCapabilities('system').canApproveCarePlan).toBe(true);
  });

  it('denies canApproveCarePlan to support-tier roles', () => {
    expect(computeProviderCapabilities('nurse').canApproveCarePlan).toBe(false);
    expect(computeProviderCapabilities('medical_assistant').canApproveCarePlan).toBe(false);
    expect(computeProviderCapabilities('support').canApproveCarePlan).toBe(false);
  });
});
