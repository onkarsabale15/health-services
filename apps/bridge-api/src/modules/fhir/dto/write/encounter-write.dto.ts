import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FhirCodeableConceptDto, FhirPeriodDto, FhirReferenceDto, FhirIdentifierDto } from '../primitives';
import { BaseFhirWriteDto } from './base-resource-write.dto';

class EncounterParticipantDto {
  @ApiPropertyOptional({ type: [FhirCodeableConceptDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FhirCodeableConceptDto)
  type?: FhirCodeableConceptDto[];

  @ApiPropertyOptional({ type: FhirPeriodDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirPeriodDto)
  period?: FhirPeriodDto;

  @ApiPropertyOptional({ type: FhirReferenceDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirReferenceDto)
  individual?: FhirReferenceDto;
}

class EncounterLocationDto {
  @ApiPropertyOptional({ type: FhirReferenceDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirReferenceDto)
  location?: FhirReferenceDto;

  @ApiPropertyOptional({ enum: ['planned', 'active', 'reserved', 'completed'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ type: FhirPeriodDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirPeriodDto)
  period?: FhirPeriodDto;
}

export class EncounterWriteDto extends BaseFhirWriteDto<'Encounter'> {
  @ApiPropertyOptional({
    enum: [
      'planned',
      'arrived',
      'triaged',
      'in-progress',
      'onleave',
      'finished',
      'cancelled',
      'entered-in-error',
      'unknown',
    ],
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Classification of the encounter (e.g. AMB, IMP, EMER)' })
  class?: Record<string, any>;

  @ApiPropertyOptional({ type: [FhirCodeableConceptDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FhirCodeableConceptDto)
  type?: FhirCodeableConceptDto[];

  @ApiPropertyOptional({ type: FhirCodeableConceptDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  serviceType?: FhirCodeableConceptDto;

  @ApiPropertyOptional({ type: FhirCodeableConceptDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  priority?: FhirCodeableConceptDto;

  @ApiPropertyOptional({ type: [FhirIdentifierDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FhirIdentifierDto)
  identifier?: FhirIdentifierDto[];

  @ApiPropertyOptional({ type: FhirPeriodDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirPeriodDto)
  period?: FhirPeriodDto;

  @ApiPropertyOptional({ type: [FhirCodeableConceptDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FhirCodeableConceptDto)
  reasonCode?: FhirCodeableConceptDto[];

  @ApiPropertyOptional({ type: [FhirReferenceDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FhirReferenceDto)
  reasonReference?: FhirReferenceDto[];

  @ApiPropertyOptional({ type: [EncounterParticipantDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => EncounterParticipantDto)
  participant?: EncounterParticipantDto[];

  @ApiPropertyOptional({ type: [EncounterLocationDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => EncounterLocationDto)
  location?: EncounterLocationDto[];

  @ApiPropertyOptional({ type: FhirReferenceDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirReferenceDto)
  serviceProvider?: FhirReferenceDto;
}
