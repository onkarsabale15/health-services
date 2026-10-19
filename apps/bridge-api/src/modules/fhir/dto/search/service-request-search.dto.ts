import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFhirSearchParams } from './base-search.dto';

export class ServiceRequestSearchParams extends BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Patient ID (required by most EHRs)', example: '12345' })
  @IsOptional()
  @IsString()
  patient?: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: ['draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Service request code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Date authored (supports ge, le prefixes)' })
  @IsOptional()
  @IsString()
  authored?: string;

  @ApiPropertyOptional({
    description: 'Intent',
    enum: [
      'proposal',
      'plan',
      'directive',
      'order',
      'original-order',
      'reflex-order',
      'filler-order',
      'instance-order',
      'option',
    ],
  })
  @IsOptional()
  @IsString()
  intent?: string;

  @ApiPropertyOptional({ description: 'Priority', enum: ['routine', 'urgent', 'asap', 'stat'] })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ description: 'Encounter reference' })
  @IsOptional()
  @IsString()
  encounter?: string;

  @ApiPropertyOptional({ description: 'Subject reference' })
  @IsOptional()
  @IsString()
  subject?: string;
}
