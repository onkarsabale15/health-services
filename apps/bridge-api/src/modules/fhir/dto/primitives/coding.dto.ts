import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FhirCodingDto {
  @ApiPropertyOptional({ example: 'http://snomed.info/sct' })
  @IsString()
  @IsOptional()
  system?: string;

  @ApiPropertyOptional({ example: '1.0' })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional({ example: '44054006' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ example: 'Type 2 diabetes mellitus' })
  @IsString()
  @IsOptional()
  display?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  userSelected?: boolean;
}
