import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Base FHIR R4 search parameters shared by all resource types.
 * See: https://hl7.org/fhir/R4/search.html
 */
export class BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Resource ID', example: 'abc-123' })
  @IsOptional()
  @IsString()
  _id?: string;

  @ApiPropertyOptional({ description: 'Number of results per page', example: '10' })
  @IsOptional()
  @IsString()
  _count?: string;

  @ApiPropertyOptional({ description: 'Page offset', example: '20' })
  @IsOptional()
  @IsString()
  _offset?: string;

  @ApiPropertyOptional({ description: 'Sort order (prefix with - for descending)', example: '-date' })
  @IsOptional()
  @IsString()
  _sort?: string;

  @ApiPropertyOptional({ description: 'Include related resources', example: 'Patient:general-practitioner' })
  @IsOptional()
  @IsString()
  _include?: string;

  @ApiPropertyOptional({ description: 'Reverse include related resources', example: 'Coverage:beneficiary' })
  @IsOptional()
  @IsString()
  _revinclude?: string;

  @ApiPropertyOptional({ description: 'Subset of resource elements to return', example: 'id,name,birthDate' })
  @IsOptional()
  @IsString()
  _elements?: string;

  @ApiPropertyOptional({ description: 'Summary mode', enum: ['true', 'text', 'data', 'count'] })
  @IsOptional()
  @IsString()
  _summary?: string;

  @ApiPropertyOptional({ description: 'Total count mode', enum: ['none', 'estimate', 'accurate'] })
  @IsOptional()
  @IsString()
  _total?: string;

  // Allow vendor-specific and forward-compatible FHIR search params
  [key: string]: any;
}
