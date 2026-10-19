import { ArrayMaxSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FhirAnnotationDto, FhirReferenceDto } from '../primitives';

/**
 * Generic base for all FHIR resource write DTOs.
 *
 * Contains fields shared across most writable resources (subject, encounter,
 * note). Resource-specific DTOs extend this class and add their own fields.
 *
 * The type parameter `TResource` narrows `resourceType` to the expected FHIR
 * type string (e.g. `'Condition'`), giving callers compile-time safety.
 */
export class BaseFhirWriteDto<TResource extends string = string> {
  @ApiPropertyOptional({ example: 'Condition' })
  @IsString()
  @IsOptional()
  resourceType?: TResource;

  @ApiPropertyOptional({ example: 'abc-123', description: 'Present on PUT only — matches the URL :id segment.' })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({
    type: FhirReferenceDto,
    description: 'Patient subject. Overridden by bridge from the session.',
  })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirReferenceDto)
  subject?: FhirReferenceDto;

  @ApiPropertyOptional({ type: FhirReferenceDto, description: 'Encounter context.' })
  @ValidateNested()
  @IsOptional()
  @Type(() => FhirReferenceDto)
  encounter?: FhirReferenceDto;

  @ApiPropertyOptional({
    type: [FhirAnnotationDto],
    description: 'Free-text clinical notes. New entries are appended on update.',
  })
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FhirAnnotationDto)
  note?: FhirAnnotationDto[];
}
