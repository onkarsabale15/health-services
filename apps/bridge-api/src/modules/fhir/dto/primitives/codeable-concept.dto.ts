import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FhirCodingDto } from './coding.dto';

export class FhirCodeableConceptDto {
  @ApiPropertyOptional({ type: [FhirCodingDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FhirCodingDto)
  coding?: FhirCodingDto[];

  @ApiPropertyOptional({ example: 'Type 2 diabetes mellitus' })
  @IsString()
  @IsOptional()
  text?: string;
}
