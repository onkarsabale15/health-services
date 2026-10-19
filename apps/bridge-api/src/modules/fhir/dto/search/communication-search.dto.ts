import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFhirSearchParams } from './base-search.dto';

export class CommunicationSearchParams extends BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Patient ID', example: '12345' })
  @IsOptional()
  @IsString()
  patient?: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: ['preparation', 'in-progress', 'not-done', 'on-hold', 'stopped', 'completed', 'entered-in-error', 'unknown'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Date sent' })
  @IsOptional()
  @IsString()
  sent?: string;

  @ApiPropertyOptional({ description: 'Date received' })
  @IsOptional()
  @IsString()
  received?: string;

  @ApiPropertyOptional({ description: 'Encounter reference' })
  @IsOptional()
  @IsString()
  encounter?: string;

  @ApiPropertyOptional({ description: 'Sender reference' })
  @IsOptional()
  @IsString()
  sender?: string;

  @ApiPropertyOptional({ description: 'Recipient reference' })
  @IsOptional()
  @IsString()
  recipient?: string;

  @ApiPropertyOptional({ description: 'Subject reference' })
  @IsOptional()
  @IsString()
  subject?: string;
}
