import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FhirReferenceDto } from './reference.dto';

export class FhirAnnotationDto {
  @ApiPropertyOptional({ example: '2024-01-15T10:30:00Z' })
  @IsString()
  @IsOptional()
  time?: string;

  @ApiPropertyOptional({ type: FhirReferenceDto })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirReferenceDto)
  authorReference?: FhirReferenceDto;

  @ApiPropertyOptional({ example: 'Dr. Smith' })
  @IsString()
  @IsOptional()
  authorString?: string;

  @ApiPropertyOptional({ example: 'Patient reports worsening symptoms.' })
  @IsString()
  @IsOptional()
  text?: string;
}
