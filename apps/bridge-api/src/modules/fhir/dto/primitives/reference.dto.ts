import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FhirReferenceDto {
  @ApiPropertyOptional({ example: 'Patient/12345' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({ example: 'Patient' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ example: 'John Smith' })
  @IsString()
  @IsOptional()
  display?: string;
}
