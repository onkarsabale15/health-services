import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CONDITION_STATE_VALUES, type ConditionStateValue } from './constants/condition-state.model';
import type { SeverityLevel, ConditionCategory } from './constants/fhir-codings';

// ─── Narrow FHIR shapes used by DTO fields ───────────────────────────────
//
// These are the bare-minimum interfaces the controllers touch. They mirror
// the FHIR R4 building blocks used by Condition / AllergyIntolerance /
// Observation / Appointment / Encounter writes. Replace `any` so the DTO
// surface is fully typed without pulling in @medplum/fhirtypes for cds-app.

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirReference {
  reference?: string;
  display?: string;
  type?: string;
}

export interface FhirQuantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
  comparator?: '<' | '<=' | '>=' | '>';
}

export interface FhirPeriod {
  start?: string;
  end?: string;
}

export interface FhirAppointmentParticipant {
  actor?: FhirReference;
  status?: 'accepted' | 'declined' | 'tentative' | 'needs-action';
  required?: 'required' | 'optional' | 'information-only';
  type?: FhirCodeableConcept[];
}

export interface FhirObservationComponent {
  code?: FhirCodeableConcept;
  valueQuantity?: FhirQuantity;
  valueString?: string;
  valueCodeableConcept?: FhirCodeableConcept;
}

export interface FhirAllergyReaction {
  manifestation?: FhirCodeableConcept[];
  severity?: 'mild' | 'moderate' | 'severe';
  description?: string;
  onset?: string;
}

/**
 * Base FHIR resource DTO — validates structural basics without enforcing
 * full FHIR schema (that's validated by the EHR).
 */
export class FhirResourceDto {
  @ApiPropertyOptional({ description: 'FHIR resource type' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  resourceType?: string;

  @ApiPropertyOptional({ description: 'Subject reference (auto-enforced to session patient)' })
  @IsObject()
  @IsOptional()
  subject?: { reference?: string; display?: string };

  @ApiPropertyOptional({ description: 'Encounter reference' })
  @IsObject()
  @IsOptional()
  encounter?: { reference?: string };

  @ApiPropertyOptional({ description: 'Coded concept' })
  @IsObject()
  @IsOptional()
  code?: FhirCodeableConcept;

  @ApiPropertyOptional({ description: 'Clinical status' })
  @IsObject()
  @IsOptional()
  clinicalStatus?: FhirCodeableConcept;

  @ApiPropertyOptional({ description: 'Category codes' })
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(10)
  category?: FhirCodeableConcept[];
}

export class CreateConditionDto extends FhirResourceDto {
  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  verificationStatus?: FhirCodeableConcept;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  severity?: FhirCodeableConcept;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  onsetDateTime?: string;
}

export class CreateAllergyDto extends FhirResourceDto {
  @ApiPropertyOptional({ enum: ['low', 'high', 'unable-to-assess'] })
  @IsString()
  @IsOptional()
  @IsIn(['low', 'high', 'unable-to-assess'])
  criticality?: 'low' | 'high' | 'unable-to-assess';

  @ApiPropertyOptional({ enum: ['allergy', 'intolerance'] })
  @IsString()
  @IsOptional()
  @IsIn(['allergy', 'intolerance'])
  type?: 'allergy' | 'intolerance';

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(20)
  reaction?: FhirAllergyReaction[];
}

export class CreateObservationDto extends FhirResourceDto {
  @ApiPropertyOptional({ enum: ['registered', 'preliminary', 'final', 'amended'] })
  @IsString()
  @IsOptional()
  status?: 'registered' | 'preliminary' | 'final' | 'amended';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  effectiveDateTime?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  valueQuantity?: FhirQuantity;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  valueString?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(20)
  component?: FhirObservationComponent[];
}

export class CreateAppointmentDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  start?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  end?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  appointmentType?: FhirCodeableConcept;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(20)
  participant?: FhirAppointmentParticipant[];

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  reasonCode?: FhirCodeableConcept[];
}

export class CreateEncounterDto extends FhirResourceDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  class?: FhirCoding;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  period?: FhirPeriod;
}

// ─── Condition Request DTO (lean) ───────────────────────────────────────────
//
// The shape the frontend sends for both create and update. The backend
// ConditionBodyBuilder turns this into a full FHIR Condition resource —
// frontend never touches FHIR URIs or HL7 value-set strings.

/**
 * A single coded concept (primary or cross-mapped). Shape matches the
 * bridge terminology API response so the frontend can forward concepts
 * directly without remapping fields.
 */
export class ConditionCodingInputDto {
  @ApiProperty({ example: 'snomed' })
  @IsString()
  @IsNotEmpty()
  system!: string;

  @ApiProperty({ example: 'http://snomed.info/sct' })
  @IsString()
  @IsNotEmpty()
  systemUri!: string;

  @ApiProperty({ example: '44054006' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({ example: 'Type 2 diabetes mellitus' })
  @IsString()
  @IsOptional()
  display?: string | null;
}

export class ConditionConceptInputDto extends ConditionCodingInputDto {
  @ApiPropertyOptional({
    description: 'Cross-mapped codings in other code systems',
    type: [ConditionCodingInputDto],
  })
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ConditionCodingInputDto)
  mappings?: ConditionCodingInputDto[];
}

const SEVERITY_VALUES: readonly SeverityLevel[] = ['mild', 'moderate', 'severe'] as const;
const CATEGORY_VALUES: readonly ConditionCategory[] = [
  'problem-list-item',
  'encounter-diagnosis',
  'health-concern',
] as const;

export class ConditionRequestDto {
  @ApiProperty({ type: ConditionConceptInputDto })
  @ValidateNested()
  @Type(() => ConditionConceptInputDto)
  concept!: ConditionConceptInputDto;

  @ApiProperty({ enum: CONDITION_STATE_VALUES })
  @IsEnum(CONDITION_STATE_VALUES)
  state!: ConditionStateValue;

  @ApiProperty({
    enum: CATEGORY_VALUES,
    description:
      'FHIR Condition category. Required — no implicit default. The FE ' +
      'auto-selects when the EHR allows only one (e.g. Epic = encounter-diagnosis); ' +
      'otherwise the user picks. In update mode the BE preserves the existing ' +
      'category regardless of what the request carries.',
  })
  @IsIn(CATEGORY_VALUES as readonly string[])
  category!: ConditionCategory;

  @ApiPropertyOptional({ enum: SEVERITY_VALUES })
  @IsOptional()
  @IsIn(SEVERITY_VALUES as readonly string[])
  severity?: SeverityLevel;

  @ApiPropertyOptional({ description: 'ISO date (YYYY-MM-DD), only for resolved state' })
  @IsOptional()
  @IsDateString()
  abatementDate?: string;

  @ApiPropertyOptional({ description: 'Free-text clinical note added to Condition.note[]' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
