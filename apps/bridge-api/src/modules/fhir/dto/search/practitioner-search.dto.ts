import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFhirSearchParams } from './base-search.dto';

export class PractitionerSearchParams extends BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Family (last) name', example: 'Smith' })
  @IsOptional()
  @IsString()
  family?: string;

  @ApiPropertyOptional({ description: 'Given (first) name', example: 'Jane' })
  @IsOptional()
  @IsString()
  given?: string;

  @ApiPropertyOptional({ description: 'Full name search', example: 'Jane Smith' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Identifier (e.g., NPI)', example: 'http://hl7.org/fhir/sid/us-npi|1234567890' })
  @IsOptional()
  @IsString()
  identifier?: string;

  @ApiPropertyOptional({ description: 'Street address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  'address-city'?: string;

  @ApiPropertyOptional({ description: 'State' })
  @IsOptional()
  @IsString()
  'address-state'?: string;

  @ApiPropertyOptional({ description: 'Whether practitioner record is active', enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  active?: string;
}
