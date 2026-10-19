import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CODING_SYSTEMS } from '../../fhir/constants/code-systems';

// ─── Terminology DTOs ────────────────────────────────────────────────────────
//
// Shared request/response shapes for the bridge terminology API. Designed to
// be code-system agnostic so new providers (LOINC, RxNorm, ...) can be added
// without changing the wire contract.

/**
 * Machine-readable identifier for a code system. Kept as a string union
 * rather than an enum so provider registration is loose — new providers
 * just pick a unique system key and add it to SUPPORTED_SYSTEMS below.
 */
export type TerminologySystem = 'snomed' | 'icd10' | 'loinc' | 'rxnorm';

/** Currently supported systems (whitelist for DTO validation). */
export const SUPPORTED_SYSTEMS: readonly TerminologySystem[] = [
  'snomed',
  'icd10',
  // 'loinc',   ← future
  // 'rxnorm',  ← future
] as const;

/**
 * Canonical FHIR system URIs keyed by our internal system identifier.
 * Derived from the shared `CODING_SYSTEMS` constants so there is exactly
 * one source of truth for URI strings in the codebase.
 *
 * `icd10` resolves to `icd-10-cm` (US Clinical Modification): the
 * terminology DB stores US-specific codes (e.g. U07.1, Z-codes) and
 * Cerner Millennium expects `icd-10-cm` on writes. Pure international
 * `icd-10` is reserved for non-US deployments — none today.
 */
export const SYSTEM_URIS: Record<TerminologySystem, string> = {
  snomed: CODING_SYSTEMS.SNOMED,
  icd10: CODING_SYSTEMS.ICD10_CM,
  loinc: CODING_SYSTEMS.LOINC,
  rxnorm: CODING_SYSTEMS.RXNORM,
};

// ─── Request DTOs ────────────────────────────────────────────────────────────

export class TerminologySearchQuery {
  @ApiProperty({
    description: 'Code system to search',
    enum: SUPPORTED_SYSTEMS,
    example: 'snomed',
  })
  @IsEnum(SUPPORTED_SYSTEMS)
  system!: TerminologySystem;

  @ApiProperty({
    description:
      'Search term (matches code prefix or display text). ' +
      'Minimum 3 characters — anything shorter returns too many ' +
      'results to be useful and wastes round-trips.',
    minLength: 3,
    example: 'malposition',
  })
  @IsString()
  @MinLength(3)
  q!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results to return',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class TerminologyLookupQuery {
  @ApiProperty({
    description: 'Code system to look up in',
    enum: SUPPORTED_SYSTEMS,
    example: 'snomed',
  })
  @IsEnum(SUPPORTED_SYSTEMS)
  system!: TerminologySystem;

  @ApiProperty({
    description: 'The concept code to look up',
    example: '93342009',
  })
  @IsString()
  @MinLength(1)
  code!: string;
}

// ─── Response DTOs ───────────────────────────────────────────────────────────

export class TerminologyConceptDto {
  @ApiProperty({ example: 'snomed' })
  system!: TerminologySystem;

  @ApiProperty({ example: 'http://snomed.info/sct' })
  systemUri!: string;

  @ApiProperty({ example: '93342009' })
  code!: string;

  @ApiProperty({
    example: 'Congenital malposition of fallopian tube',
    nullable: true,
  })
  display!: string | null;
}

export class TerminologyConceptWithMappingsDto extends TerminologyConceptDto {
  @ApiProperty({
    description:
      'Cross-mapped concepts in other code systems for this code. ' +
      'For a SNOMED concept this is the paired ICD-10 code; for an ICD-10 ' +
      'concept it is the paired SNOMED code(s).',
    type: [TerminologyConceptDto],
  })
  mappings!: TerminologyConceptDto[];
}

export class TerminologySearchResponseDto {
  @ApiProperty({ type: [TerminologyConceptWithMappingsDto] })
  results!: TerminologyConceptWithMappingsDto[];

  @ApiProperty({ example: 12 })
  count!: number;
}
