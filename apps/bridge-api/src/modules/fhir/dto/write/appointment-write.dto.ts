import { IsArray, IsDateString, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FhirCodeableConceptDto, FhirPeriodDto, FhirReferenceDto, FhirIdentifierDto } from '../primitives';
import { BaseFhirWriteDto } from './base-resource-write.dto';

class AppointmentParticipantDto {
  @ApiPropertyOptional({ type: [FhirCodeableConceptDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FhirCodeableConceptDto)
  type?: FhirCodeableConceptDto[];

  @ApiPropertyOptional({ type: FhirReferenceDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirReferenceDto)
  actor?: FhirReferenceDto;

  @ApiPropertyOptional({ enum: ['required', 'optional', 'information-only'] })
  @IsString()
  @IsOptional()
  required?: string;

  @ApiPropertyOptional({ enum: ['accepted', 'declined', 'tentative', 'needs-action'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ type: FhirPeriodDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirPeriodDto)
  period?: FhirPeriodDto;
}

export class AppointmentWriteDto extends BaseFhirWriteDto<'Appointment'> {
  @ApiPropertyOptional({
    enum: [
      'proposed',
      'pending',
      'booked',
      'arrived',
      'fulfilled',
      'cancelled',
      'noshow',
      'entered-in-error',
      'checked-in',
      'waitlist',
    ],
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ type: FhirCodeableConceptDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  serviceType?: FhirCodeableConceptDto;

  @ApiPropertyOptional({ type: FhirCodeableConceptDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  appointmentType?: FhirCodeableConceptDto;

  @ApiPropertyOptional({ type: [FhirCodeableConceptDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FhirCodeableConceptDto)
  reasonCode?: FhirCodeableConceptDto[];

  @ApiPropertyOptional({ type: [FhirReferenceDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FhirReferenceDto)
  reasonReference?: FhirReferenceDto[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  start?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  end?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  minutesDuration?: number;

  @ApiPropertyOptional({ type: [FhirIdentifierDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FhirIdentifierDto)
  identifier?: FhirIdentifierDto[];

  @ApiPropertyOptional({ type: [AppointmentParticipantDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AppointmentParticipantDto)
  participant?: AppointmentParticipantDto[];
}
