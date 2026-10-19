import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FhirQuantityDto {
  @ApiPropertyOptional({ example: 120 })
  @IsNumber()
  @IsOptional()
  value?: number;

  @ApiPropertyOptional({ example: '<' })
  @IsString()
  @IsOptional()
  comparator?: string;

  @ApiPropertyOptional({ example: 'mmHg' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({ example: 'http://unitsofmeasure.org' })
  @IsString()
  @IsOptional()
  system?: string;

  @ApiPropertyOptional({ example: 'mm[Hg]' })
  @IsString()
  @IsOptional()
  code?: string;
}
