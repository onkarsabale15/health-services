import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFhirSearchParams } from './base-search.dto';

export class ObservationSearchParams extends BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Patient ID (required by most EHRs)', example: '12345' })
  @IsOptional()
  @IsString()
  patient?: string;

  @ApiPropertyOptional({
    description: 'Category',
    enum: [
      'vital-signs',
      'laboratory',
      'social-history',
      'survey',
      'imaging',
      'procedure',
      'exam',
      'therapy',
      'activity',
    ],
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Observation code (LOINC)', example: 'http://loinc.org|85354-9' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Effective date (supports ge, le prefixes)', example: 'ge2025-01-01' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Subject reference', example: 'Patient/12345' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Encounter reference' })
  @IsOptional()
  @IsString()
  encounter?: string;

  @ApiPropertyOptional({ description: 'Combo code (code or component code)' })
  @IsOptional()
  @IsString()
  'combo-code'?: string;

  @ApiPropertyOptional({ description: 'Component code' })
  @IsOptional()
  @IsString()
  'component-code'?: string;

  @ApiPropertyOptional({ description: 'Value concept' })
  @IsOptional()
  @IsString()
  'value-concept'?: string;

  @ApiPropertyOptional({ description: 'Performer reference' })
  @IsOptional()
  @IsString()
  performer?: string;
}
