import { z } from 'zod';
import type { LlmProviderType } from '@hs/ai';

// ─── Model Configuration ─────────────────────────────────────

export interface ModelConfig {
  provider: LlmProviderType;
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  baseUrl?: string;
  region?: string;
}

// ─── CDS Rule (mirrors Prisma CdsRule, but decoupled) ─────────

export interface CdsRule {
  id: string;
  name: string;
  description?: string;
  hook: string;
  fhirResources: string[];
  promptTemplate?: string;
  modelProvider: string;
  modelName: string;
  isActive: boolean;
}

// ─── FHIR Fetch Functions (injected, DIP) ─────────────────────

export type FhirSearchFn = (resourceType: string, params: Record<string, string>) => Promise<any>;

export type FhirReadFn = (resourceType: string, id: string) => Promise<any>;

// ─── CDS Card (output) ───────────────────────────────────────

export const CdsCardCategoryEnum = z.enum([
  'pcp-suggestion',
  'allergy-caution',
  'drug-interaction',
  'missing-screening',
  'care-gap',
  'patient-safety',
]);

export const CdsSeverityEnum = z.enum(['critical', 'warning', 'info']);

export const RelatedResourceSchema = z.object({
  resourceType: z.string(),
  id: z.string(),
});

export const FhirCodingSchema = z.object({
  system: z.string(), // e.g., "http://snomed.info/sct", "http://loinc.org"
  code: z.string(), // e.g., "419511003"
  display: z.string(), // e.g., "Propensity to adverse reactions to drug"
});

export const CdsCardSchema = z.object({
  category: CdsCardCategoryEnum,
  severity: CdsSeverityEnum,
  summary: z.string().max(200),
  detail: z.string(),
  suggestions: z.array(z.string()),
  references: z.array(z.string()).optional(),
  relatedResources: z.array(RelatedResourceSchema).optional(),
  coding: FhirCodingSchema.optional(),
});

export const CdsCardArraySchema = z.array(CdsCardSchema);

export type CdsCard = z.infer<typeof CdsCardSchema>;
export type CdsCardCategory = z.infer<typeof CdsCardCategoryEnum>;
export type CdsSeverity = z.infer<typeof CdsSeverityEnum>;
export type FhirCoding = z.infer<typeof FhirCodingSchema>;

// ─── Analysis Configuration ──────────────────────────────────

export interface AnalysisConfig {
  patientId: string;
  encounterId?: string;
  rules: CdsRule[];
  modelConfig?: Partial<ModelConfig>;
  searchFn: FhirSearchFn;
  readFn: FhirReadFn;
  verbose?: boolean;
}

export interface AnalysisResult {
  cards: CdsCard[];
  tokensUsed?: number;
  durationMs: number;
}
