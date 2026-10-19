import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFhirSearchParams } from './base-search.dto';

export class TaskSearchParams extends BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Patient ID', example: '12345' })
  @IsOptional()
  @IsString()
  patient?: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: [
      'draft',
      'requested',
      'received',
      'accepted',
      'rejected',
      'ready',
      'cancelled',
      'in-progress',
      'on-hold',
      'failed',
      'completed',
      'entered-in-error',
    ],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Task code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Intent',
    enum: [
      'unknown',
      'proposal',
      'plan',
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

  @ApiPropertyOptional({ description: 'Date authored (supports ge, le prefixes)' })
  @IsOptional()
  @IsString()
  'authored-on'?: string;

  @ApiPropertyOptional({ description: 'Owner reference' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiPropertyOptional({ description: 'Requester reference' })
  @IsOptional()
  @IsString()
  requester?: string;

  @ApiPropertyOptional({ description: 'Subject reference' })
  @IsOptional()
  @IsString()
  subject?: string;
}
