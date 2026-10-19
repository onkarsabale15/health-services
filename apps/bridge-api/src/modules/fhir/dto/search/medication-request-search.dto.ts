import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFhirSearchParams } from './base-search.dto';

export class MedicationRequestSearchParams extends BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Patient ID', example: '12345' })
  @IsOptional()
  @IsString()
  patient?: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: ['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Medication intent',
    enum: ['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option'],
  })
  @IsOptional()
  @IsString()
  intent?: string;

  @ApiPropertyOptional({ description: 'Date written (supports ge, le prefixes)' })
  @IsOptional()
  @IsString()
  authoredon?: string;

  @ApiPropertyOptional({ description: 'Subject reference' })
  @IsOptional()
  @IsString()
  subject?: string;
}
