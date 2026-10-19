import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFhirSearchParams } from './base-search.dto';

export class AppointmentSearchParams extends BaseFhirSearchParams {
  @ApiPropertyOptional({ description: 'Patient ID', example: '12345' })
  @IsOptional()
  @IsString()
  patient?: string;

  @ApiPropertyOptional({ description: 'Appointment date (supports ge, le prefixes)', example: 'ge2025-01-01' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: ['proposed', 'pending', 'booked', 'arrived', 'fulfilled', 'cancelled', 'noshow'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Practitioner reference' })
  @IsOptional()
  @IsString()
  practitioner?: string;

  @ApiPropertyOptional({ description: 'Location reference' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Service type' })
  @IsOptional()
  @IsString()
  'service-type'?: string;

  @ApiPropertyOptional({ description: 'Identifier' })
  @IsOptional()
  @IsString()
  identifier?: string;
}
