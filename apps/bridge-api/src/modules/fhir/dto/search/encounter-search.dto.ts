import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFhirSearchParams } from './base-search.dto';

export class EncounterSearchParams extends BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Patient ID', example: '12345' })
  @IsOptional()
  @IsString()
  patient?: string;

  @ApiPropertyOptional({ description: 'Encounter date (supports ge, le prefixes)', example: 'ge2025-01-01' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Encounter class (system|code)',
    example: 'http://terminology.hl7.org/CodeSystem/v3-ActCode|AMB',
  })
  @IsOptional()
  @IsString()
  class?: string;

  @ApiPropertyOptional({ description: 'Encounter type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Participant (practitioner) reference' })
  @IsOptional()
  @IsString()
  participant?: string;

  @ApiPropertyOptional({ description: 'Location reference' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Reason code' })
  @IsOptional()
  @IsString()
  'reason-code'?: string;

  @ApiPropertyOptional({ description: 'Identifier' })
  @IsOptional()
  @IsString()
  identifier?: string;

  @ApiPropertyOptional({ description: 'Subject reference', example: 'Patient/12345' })
  @IsOptional()
  @IsString()
  subject?: string;
}
