import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFhirSearchParams } from './base-search.dto';

export class CoverageSearchParams extends BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Patient ID', example: '12345' })
  @IsOptional()
  @IsString()
  patient?: string;

  @ApiPropertyOptional({ description: 'Beneficiary reference' })
  @IsOptional()
  @IsString()
  beneficiary?: string;

  @ApiPropertyOptional({ description: 'Subscriber reference' })
  @IsOptional()
  @IsString()
  subscriber?: string;

  @ApiPropertyOptional({ description: 'Status', enum: ['active', 'cancelled', 'draft', 'entered-in-error'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Coverage type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Class type' })
  @IsOptional()
  @IsString()
  'class-type'?: string;

  @ApiPropertyOptional({ description: 'Identifier' })
  @IsOptional()
  @IsString()
  identifier?: string;

  @ApiPropertyOptional({ description: 'Payor reference' })
  @IsOptional()
  @IsString()
  payor?: string;
}
