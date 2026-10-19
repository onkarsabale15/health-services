import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFhirSearchParams } from './base-search.dto';

export class DocumentReferenceSearchParams extends BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Patient ID (required by most EHRs)', example: '12345' })
  @IsOptional()
  @IsString()
  patient?: string;

  @ApiPropertyOptional({ description: 'Document status', enum: ['current', 'superseded', 'entered-in-error'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Document type (LOINC)', example: 'http://loinc.org|34117-2' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Document date (supports ge, le prefixes)' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Service period (supports ge, le prefixes)' })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({ description: 'Encounter reference' })
  @IsOptional()
  @IsString()
  encounter?: string;

  @ApiPropertyOptional({ description: 'Author reference' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({ description: 'Subject reference' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Identifier' })
  @IsOptional()
  @IsString()
  identifier?: string;
}
