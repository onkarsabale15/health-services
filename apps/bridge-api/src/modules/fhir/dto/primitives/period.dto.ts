import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FhirPeriodDto {
  @ApiPropertyOptional({ example: '2024-01-15T10:00:00Z' })
  @IsDateString()
  @IsOptional()
  start?: string;

  @ApiPropertyOptional({ example: '2024-01-15T11:00:00Z' })
  @IsDateString()
  @IsOptional()
  end?: string;
}
