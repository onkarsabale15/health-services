import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFhirSearchParams } from './base-search.dto';

export class MedicationStatementSearchParams extends BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Patient ID (required by most EHRs)', example: '12345' })
  @IsOptional()
  @IsString()
  patient?: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: ['active', 'completed', 'entered-in-error', 'intended', 'stopped', 'on-hold', 'unknown', 'not-taken'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Medication code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Effective date (supports ge, le prefixes)' })
  @IsOptional()
  @IsString()
  effective?: string;

  @ApiPropertyOptional({ description: 'Subject reference' })
  @IsOptional()
  @IsString()
  subject?: string;
}
