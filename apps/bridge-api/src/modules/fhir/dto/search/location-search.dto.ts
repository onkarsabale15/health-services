import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFhirSearchParams } from './base-search.dto';

export class LocationSearchParams extends BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Location name' })
  @IsOptional()
  @IsString()
  name?: string;

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

  @ApiPropertyOptional({ description: 'Postal code' })
  @IsOptional()
  @IsString()
  'address-postalcode'?: string;

  @ApiPropertyOptional({ description: 'Location type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Status', enum: ['active', 'suspended', 'inactive'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Identifier' })
  @IsOptional()
  @IsString()
  identifier?: string;

  @ApiPropertyOptional({ description: 'Organization reference' })
  @IsOptional()
  @IsString()
  organization?: string;
}
