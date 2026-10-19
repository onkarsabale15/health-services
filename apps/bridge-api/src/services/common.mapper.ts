import type { FhirSearchParams } from './vendor-data-service.interface';

/**
 * Common search parameter mapping and cleaning utilities.
 * Reduces boilerplate for FHIR-native EHRs.
 */
export const commonMapper = {
  /**
   * Cleans search parameters by:
   * 1. Removing undefined/null/empty strings.
   * 2. Standardizing common pagination keys (_count, _id).
   * 3. Retaining all other FHIR-compliant keys.
   */
  mapSearchParams(params: FhirSearchParams): Record<string, string | number | boolean> {
    const cleaned: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;

      // Handle array values (e.g. category=val1,val2)
      if (Array.isArray(value)) {
        cleaned[key] = value.join(',');
        continue;
      }

      // Pass through primitive values
      cleaned[key] = value as string | number | boolean;
    }

    return cleaned;
  },
};
