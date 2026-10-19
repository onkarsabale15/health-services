import { ReferenceResourceType, ReferenceProps } from '../fhir-mapper.types';

const ALLOWED_REFERENCE_TYPES: Set<ReferenceResourceType> = new Set([
  'Patient',
  'Practitioner',
  'PractitionerRole',
  'RelatedPerson',
  'Organization',
  'Location',
  'Device',
  'Medication',
  'Substance',
  'MedicationStatement',
  'MedicationRequest',
  'Observation',
  'Condition',
  'Procedure',
  'Encounter',
  'EpisodeOfCare',
  'CarePlan',
  'ServiceRequest',
  'DiagnosticReport',
  'Appointment',
]);

export class Reference {
  type?: ReferenceResourceType;
  reference?: string;
  display?: string;

  constructor(referenceProps: ReferenceProps, referencedResource: ReferenceResourceType) {
    const { reference, display } = referenceProps;

    if (reference && !ALLOWED_REFERENCE_TYPES.has(referencedResource)) {
      throw new Error(`Invalid reference type: ${referencedResource}`);
    }

    if (reference) {
      this.type = referencedResource;
      this.reference = `${referencedResource}/${reference}`;
    }

    if (display) {
      this.display = display;
    }
  }
}
