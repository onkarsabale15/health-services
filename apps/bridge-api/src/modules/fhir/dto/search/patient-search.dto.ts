import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFhirSearchParams } from './base-search.dto';

export class PatientSearchParams extends BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Family (last) name', example: 'Smith' })
  @IsOptional()
  @IsString()
  family?: string;

  @ApiPropertyOptional({ description: 'Given (first) name', example: 'John' })
  @IsOptional()
  @IsString()
  given?: string;

  @ApiPropertyOptional({ description: 'Full name search (family + given)', example: 'John Smith' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Birth date (YYYY-MM-DD)', example: '1990-01-15' })
  @IsOptional()
  @IsString()
  birthdate?: string;

  @ApiPropertyOptional({ description: 'Gender', enum: ['male', 'female', 'other', 'unknown'] })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'Identifier (system|value)', example: 'http://hospital.org/mrn|12345' })
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

  @ApiPropertyOptional({ description: 'Postal/ZIP code' })
  @IsOptional()
  @IsString()
  'address-postalcode'?: string;

  @ApiPropertyOptional({ description: 'Telecom (phone/email)', example: 'phone|555-123-4567' })
  @IsOptional()
  @IsString()
  telecom?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'General practitioner reference' })
  @IsOptional()
  @IsString()
  'general-practitioner'?: string;

  @ApiPropertyOptional({ description: 'Organization reference' })
  @IsOptional()
  @IsString()
  organization?: string;

  @ApiPropertyOptional({ description: 'Whether patient record is active', enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  active?: string;
}
