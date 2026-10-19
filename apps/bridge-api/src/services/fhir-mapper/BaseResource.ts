import { ResourceType } from './fhir-mapper.types';

const ALLOWED_RESOURCES: Set<ResourceType> = new Set([
  'Patient',
  'Coverage',
  'Condition',
  'AllergyIntolerance',
  'Observation',
  'DocumentReference',
  'MedicationStatement',
  'Appointment',
  'Encounter',
  'Practitioner',
  'OperationOutcome',
  'Parameters',
]);

export class BaseResource {
  resourceType: ResourceType;
  data: Record<string, unknown>;

  constructor(resourceType: ResourceType, id?: string | number) {
    if (!ALLOWED_RESOURCES.has(resourceType)) {
      throw new Error(`Invalid resourceType: ${resourceType}. Must be one of: ${[...ALLOWED_RESOURCES].join(', ')}`);
    }
    this.resourceType = resourceType;
    this.data = { resourceType };
    this.addData({ id: id != null ? id.toString() : undefined });
  }

  addData(data: Record<string, unknown>): void {
    Object.assign(this.data, data);
  }

  getCleanResource(): Record<string, unknown> | null {
    return BaseResource._clean(this.data) as Record<string, unknown> | null;
  }

  static _clean(data: unknown): unknown {
    if (Array.isArray(data)) {
      return (data as unknown[])
        .map(BaseResource._clean)
        .filter((item) => Boolean(item) && !(typeof item === 'object' && Object.keys(item as object).length === 0));
    } else if (typeof data === 'object' && data !== null) {
      const cleanedObj = Object.fromEntries(
        Object.entries(data as Record<string, unknown>)
          .map(([key, value]) => [key, BaseResource._clean(value)])
          .filter(
            ([, value]) => Boolean(value) && !(typeof value === 'object' && Object.keys(value as object).length === 0),
          ),
      );
      return Object.keys(cleanedObj).length ? cleanedObj : null;
    }
    return data;
  }
}
