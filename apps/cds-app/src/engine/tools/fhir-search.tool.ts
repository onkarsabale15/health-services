import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { FhirSearchFn } from '../cds-engine.types';

const searchSchema = z.object({
  resourceType: z.string().describe('FHIR resource type (e.g., "Condition", "AllergyIntolerance")'),
  params: z
    .record(z.string(), z.string())
    .describe('Search parameters as key-value pairs (e.g., { "patient": "123", "clinical-status": "active" })'),
});

export function createFhirSearchTool(searchFn: FhirSearchFn): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'fhir_search',
    description:
      'Search for FHIR resources. Always scope searches to the current patient using the "patient" parameter. ' +
      'Common resource types: Patient, Condition, AllergyIntolerance, MedicationStatement, Observation, ' +
      'Procedure, Encounter, CareTeam, Practitioner, Immunization, DiagnosticReport, CarePlan.',
    schema: searchSchema,
    func: async (input: { resourceType: string; params: Record<string, string> }) => {
      const result = await searchFn(input.resourceType, input.params);
      return JSON.stringify(result);
    },
  } as any); // LangChain DynamicStructuredTool has excessively deep type instantiation with zod
}
