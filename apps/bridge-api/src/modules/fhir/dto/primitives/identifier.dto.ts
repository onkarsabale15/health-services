import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FhirCodeableConceptDto } from './codeable-concept.dto';
import { FhirPeriodDto } from './period.dto';
import { FhirReferenceDto } from './reference.dto';

export class FhirIdentifierDto {
  @ApiPropertyOptional({ enum: ['usual', 'official', 'temp', 'secondary', 'old'] })
  @IsString()
  @IsOptional()
  use?: string;

  @ApiPropertyOptional({ type: FhirCodeableConceptDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirCodeableConceptDto)
  type?: FhirCodeableConceptDto;

  @ApiPropertyOptional({ example: 'http://hospital.example.org/mrn' })
  @IsString()
  @IsOptional()
  system?: string;

  @ApiPropertyOptional({ example: 'MRN-12345' })
  @IsString()
  @IsOptional()
  value?: string;

  @ApiPropertyOptional({ type: FhirPeriodDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirPeriodDto)
  period?: FhirPeriodDto;

  @ApiPropertyOptional({ type: FhirReferenceDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirReferenceDto)
  assigner?: FhirReferenceDto;
}
