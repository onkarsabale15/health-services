import { ArrayMaxSize, IsArray, IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FhirCodeableConceptDto, FhirReferenceDto } from '../primitives';
import { BaseFhirWriteDto } from './base-resource-write.dto';

class AllergyReactionDto {
  @ApiPropertyOptional({ type: FhirCodeableConceptDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  substance?: FhirCodeableConceptDto;

  @ApiPropertyOptional({ type: [FhirCodeableConceptDto] })
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FhirCodeableConceptDto)
  manifestation?: FhirCodeableConceptDto[];

  @ApiPropertyOptional({ enum: ['mild', 'moderate', 'severe'] })
  @IsString()
  @IsOptional()
  severity?: string;

  @ApiPropertyOptional({ type: FhirCodeableConceptDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  exposureRoute?: FhirCodeableConceptDto;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  onset?: string;
}

export class AllergyWriteDto extends BaseFhirWriteDto<'AllergyIntolerance'> {
  @ApiPropertyOptional({ enum: ['allergy', 'intolerance'] })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ enum: ['food', 'medication', 'environment', 'biologic'] })
  @IsString()
  @IsOptional()
  category?: string[];

  @ApiPropertyOptional({ enum: ['low', 'high', 'unable-to-assess'] })
  @IsString()
  @IsOptional()
  criticality?: string;

  @ApiPropertyOptional({ type: FhirCodeableConceptDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  clinicalStatus?: FhirCodeableConceptDto;

  @ApiPropertyOptional({ type: FhirCodeableConceptDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  verificationStatus?: FhirCodeableConceptDto;

  @ApiProperty({ type: FhirCodeableConceptDto, description: 'Substance or product that the patient is allergic to.' })
  @ValidateNested()
  @Type(() => FhirCodeableConceptDto)
  code!: FhirCodeableConceptDto;

  @ApiPropertyOptional({ type: FhirReferenceDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirReferenceDto)
  patient?: FhirReferenceDto;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  onsetDateTime?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  recordedDate?: string;

  @ApiPropertyOptional({ type: FhirReferenceDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirReferenceDto)
  recorder?: FhirReferenceDto;

  @ApiPropertyOptional({ type: FhirReferenceDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirReferenceDto)
  asserter?: FhirReferenceDto;

  @ApiPropertyOptional({ type: [AllergyReactionDto] })
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AllergyReactionDto)
  reaction?: AllergyReactionDto[];
}
