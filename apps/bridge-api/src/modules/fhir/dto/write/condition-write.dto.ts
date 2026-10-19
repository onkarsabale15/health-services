import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FhirCodeableConceptDto } from '../primitives';
import { BaseFhirWriteDto } from './base-resource-write.dto';

export class ConditionWriteDto extends BaseFhirWriteDto<'Condition'> {
  @ApiProperty({ type: FhirCodeableConceptDto, description: 'Must contain at least one SNOMED CT or ICD coding.' })
  @ValidateNested()
  @Type(() => FhirCodeableConceptDto)
  code!: FhirCodeableConceptDto;

  @ApiPropertyOptional({
    type: FhirCodeableConceptDto,
    description: 'active | recurrence | remission | inactive | resolved | entered-in-error',
  })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  clinicalStatus?: FhirCodeableConceptDto;

  @ApiPropertyOptional({
    type: FhirCodeableConceptDto,
    description: 'unconfirmed | provisional | differential | confirmed | refuted | entered-in-error',
  })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  verificationStatus?: FhirCodeableConceptDto;

  @ApiPropertyOptional({
    type: [FhirCodeableConceptDto],
    description: 'problem-list-item | encounter-diagnosis. Vendor normalizers may override.',
  })
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(5)
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FhirCodeableConceptDto)
  category?: FhirCodeableConceptDto[];

  @ApiPropertyOptional({ type: FhirCodeableConceptDto, description: 'SNOMED severity: mild | moderate | severe' })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  severity?: FhirCodeableConceptDto;

  @ApiPropertyOptional({ example: '2023-06-01T00:00:00Z' })
  @IsDateString()
  @IsOptional()
  onsetDateTime?: string;

  @ApiPropertyOptional({ example: '2024-01-15T00:00:00Z', description: 'Only for resolved/remission states.' })
  @IsDateString()
  @IsOptional()
  abatementDateTime?: string;
}
