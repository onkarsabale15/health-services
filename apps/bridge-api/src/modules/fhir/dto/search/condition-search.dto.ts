import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFhirSearchParams } from './base-search.dto';

export class ConditionSearchParams extends BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Patient ID (required by most EHRs)', example: '12345' })
  @IsString()
  patient?: string;

  @ApiPropertyOptional({
    description: 'Clinical status',
    enum: ['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'],
  })
  @IsOptional()
  @IsString()
  'clinical-status'?: string;

  @ApiPropertyOptional({
    description: 'Verification status',
    enum: ['unconfirmed', 'provisional', 'differential', 'confirmed', 'refuted', 'entered-in-error'],
  })
  @IsOptional()
  @IsString()
  'verification-status'?: string;

  @ApiPropertyOptional({
    description: 'Category',
    enum: ['problem-list-item', 'encounter-diagnosis', 'health-concern'],
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Condition code (system|code)', example: 'http://snomed.info/sct|38341003' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Severity', enum: ['mild', 'moderate', 'severe'] })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({ description: 'Onset date (supports ge, le prefixes)' })
  @IsOptional()
  @IsString()
  'onset-date'?: string;

  @ApiPropertyOptional({ description: 'Date condition was recorded' })
  @IsOptional()
  @IsString()
  'recorded-date'?: string;

  @ApiPropertyOptional({ description: 'Encounter reference' })
  @IsOptional()
  @IsString()
  encounter?: string;

  @ApiPropertyOptional({ description: 'Subject reference', example: 'Patient/12345' })
  @IsOptional()
  @IsString()
  subject?: string;
}
