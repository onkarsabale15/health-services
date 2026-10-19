import { IsArray, IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FhirCodeableConceptDto, FhirQuantityDto, FhirPeriodDto, FhirReferenceDto } from '../primitives';
import { BaseFhirWriteDto } from './base-resource-write.dto';

class ObservationComponentDto {
  @ApiProperty({ type: FhirCodeableConceptDto })
  @ValidateNested()
  @Type(() => FhirCodeableConceptDto)
  code!: FhirCodeableConceptDto;

  @ApiPropertyOptional({ type: FhirQuantityDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirQuantityDto)
  valueQuantity?: FhirQuantityDto;

  @ApiPropertyOptional({ type: FhirCodeableConceptDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  valueCodeableConcept?: FhirCodeableConceptDto;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  valueString?: string;
}

export class ObservationWriteDto extends BaseFhirWriteDto<'Observation'> {
  @ApiPropertyOptional({
    enum: ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'],
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ type: [FhirCodeableConceptDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FhirCodeableConceptDto)
  category?: FhirCodeableConceptDto[];

  @ApiProperty({ type: FhirCodeableConceptDto, description: 'LOINC or other observation code.' })
  @ValidateNested()
  @Type(() => FhirCodeableConceptDto)
  code!: FhirCodeableConceptDto;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  effectiveDateTime?: string;

  @ApiPropertyOptional({ type: FhirPeriodDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirPeriodDto)
  effectivePeriod?: FhirPeriodDto;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  issued?: string;

  @ApiPropertyOptional({ type: [FhirReferenceDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FhirReferenceDto)
  performer?: FhirReferenceDto[];

  @ApiPropertyOptional({ type: FhirQuantityDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirQuantityDto)
  valueQuantity?: FhirQuantityDto;

  @ApiPropertyOptional({ type: FhirCodeableConceptDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  valueCodeableConcept?: FhirCodeableConceptDto;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  valueString?: string;

  @ApiPropertyOptional({ type: FhirCodeableConceptDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  bodySite?: FhirCodeableConceptDto;

  @ApiPropertyOptional({ type: FhirCodeableConceptDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  method?: FhirCodeableConceptDto;

  @ApiPropertyOptional({ type: [ObservationComponentDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ObservationComponentDto)
  component?: ObservationComponentDto[];
}
