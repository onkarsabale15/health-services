import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFhirSearchParams } from './base-search.dto';

export class AllergyIntoleranceSearchParams extends BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Patient ID (required by most EHRs)', example: '12345' })
  @IsOptional()
  @IsString()
  patient?: string;

  @ApiPropertyOptional({ description: 'Clinical status', enum: ['active', 'inactive', 'resolved'] })
  @IsOptional()
  @IsString()
  'clinical-status'?: string;

  @ApiPropertyOptional({
    description: 'Verification status',
    enum: ['unconfirmed', 'confirmed', 'refuted', 'entered-in-error'],
  })
  @IsOptional()
  @IsString()
  'verification-status'?: string;

  @ApiPropertyOptional({ description: 'Allergy type', enum: ['allergy', 'intolerance'] })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Category', enum: ['food', 'medication', 'environment', 'biologic'] })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Criticality', enum: ['low', 'high', 'unable-to-assess'] })
  @IsOptional()
  @IsString()
  criticality?: string;

  @ApiPropertyOptional({
    description: 'Allergy code (system|code)',
    example: 'http://www.nlm.nih.gov/research/umls/rxnorm|7980',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Date allergy was recorded' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Date of onset' })
  @IsOptional()
  @IsString()
  onset?: string;
}
