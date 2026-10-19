// Types
export type {
  ModelConfig,
  CdsRule,
  CdsCard,
  CdsCardCategory,
  CdsSeverity,
  FhirSearchFn,
  FhirReadFn,
  AnalysisConfig,
  AnalysisResult,
} from './cds-engine.types';

export { CdsCardSchema, CdsCardArraySchema, CdsSeverityEnum, CdsCardCategoryEnum } from './cds-engine.types';

// Model factory
export { createModel } from './models/model-factory';

// FHIR tools (DIP: accept injected functions)
export { createFhirTools, createFhirSearchTool, createFhirReadTool } from './tools';

// Agent
export { runClinicalAnalysis } from './agents/clinical-analyst.agent';

// Output utilities
export { parseCards } from './output/cds-card-parser';
export { mergeCards } from './output/card-merger';

// Prompts
export { SYSTEM_PROMPT, PCP_PROMPT, MEDICATION_PROMPT, PREVENTIVE_CARE_PROMPT, SAFETY_PROMPT } from './prompts/system';
