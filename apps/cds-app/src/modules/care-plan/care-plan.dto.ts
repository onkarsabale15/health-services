import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CdsCard } from '../../engine';

export class CreateCarePlanDto {
  @ApiProperty({ description: 'Care plan title' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: 'CDS cards array (JSON)', type: 'array', items: { type: 'object' } })
  @IsArray()
  cards!: CdsCard[];

  @ApiPropertyOptional({ description: 'Provider display name' })
  @IsString()
  @IsOptional()
  providerName?: string;

  @ApiPropertyOptional({ description: 'Provider FHIR ID' })
  @IsString()
  @IsOptional()
  providerFhirId?: string;
}

export class UpdateCarePlanDto {
  @ApiPropertyOptional({ description: 'Updated title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Updated cards array (JSON)', type: 'array', items: { type: 'object' } })
  @IsArray()
  @IsOptional()
  cards?: CdsCard[];
}

export class RevokeCarePlanDto {
  @ApiProperty({ description: 'Reason for revoking this care plan', minLength: 1 })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
