import { StructuredTool } from '@langchain/core/tools';
import { FhirSearchFn, FhirReadFn } from '../cds-engine.types';
import { createFhirSearchTool } from './fhir-search.tool';
import { createFhirReadTool } from './fhir-read.tool';

export { createFhirSearchTool } from './fhir-search.tool';
export { createFhirReadTool } from './fhir-read.tool';

export function createFhirTools(searchFn: FhirSearchFn, readFn: FhirReadFn): StructuredTool[] {
  return [createFhirSearchTool(searchFn), createFhirReadTool(readFn)];
}
