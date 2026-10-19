import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { FhirReadFn } from '../cds-engine.types';

const readSchema = z.object({
  resourceType: z.string().describe('FHIR resource type (e.g., "Patient", "Practitioner")'),
  id: z.string().describe('Resource ID'),
});

export function createFhirReadTool(readFn: FhirReadFn): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'fhir_read',
    description:
      'Read a single FHIR resource by its type and ID. Use this when you have a specific resource reference ' +
      '(e.g., from a search result) and need to fetch the full resource details.',
    schema: readSchema,
    func: async (input: { resourceType: string; id: string }) => {
      const result = await readFn(input.resourceType, input.id);
      return JSON.stringify(result);
    },
  } as any); // LangChain DynamicStructuredTool has excessively deep type instantiation with zod
}
