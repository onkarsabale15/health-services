import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateConnectionDto {
  @ApiProperty({ description: 'EHR vendor name (e.g. epic, cerner, athenanet)', example: 'epic' })
  @IsString()
  @IsNotEmpty()
  ehrName!: string;

  @ApiPropertyOptional({ description: 'Authorization code (required for authorization_code grant type flows)' })
  @IsOptional()
  @IsString()
  code?: string;
}

export class ConnectionResponseDto {
  @ApiProperty({ description: 'Unique connection ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  connectionId!: string;

  @ApiProperty({ description: 'EHR vendor name', example: 'epic' })
  ehrName!: string;

  @ApiPropertyOptional({ description: 'Application type', example: 'system' })
  appType?: string;

  @ApiPropertyOptional({ description: 'OAuth grant type', example: 'client_credentials' })
  grantType?: string;

  @ApiPropertyOptional({ description: 'Access token' })
  accessToken?: string;

  @ApiPropertyOptional({ description: 'Token expiration in seconds', example: 3570 })
  expiresIn?: number;

  @ApiPropertyOptional({ description: 'Whether this was returned from cache' })
  cached?: boolean;

  @ApiPropertyOptional({
    description: 'Resolved FHIR base URL (from cache)',
    example: 'https://fhir.epic.com/interconnect-fhir-oauth',
  })
  resolvedBaseUrl?: string;

  @ApiPropertyOptional({
    description: 'Resolved auth/token URL (from cache)',
    example: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
  })
  resolvedAuthUrl?: string;

  @ApiPropertyOptional({ description: 'Resolved extra URLs (tokenUrl, fhirBaseUrl, etc.)' })
  resolvedExtraUrls?: Record<string, string>;
}

export class DeleteConnectionResponseDto {
  @ApiProperty({ example: 'Connection deleted' })
  message!: string;
}
