import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { getAllScopes } from '@hs/config';

// ─── Request DTOs ────────────────────────────────────────

export class TokenRequestDto {
  @ApiProperty({
    description: 'OAuth 2.0 grant type',
    enum: ['client_credentials', 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'authorization_code', 'refresh_token'],
    example: 'client_credentials',
  })
  @IsString()
  grant_type!: string;

  @ApiPropertyOptional({
    description: 'Refresh token (for refresh_token grant type)',
  })
  @IsOptional()
  @IsString()
  refresh_token?: string;

  @ApiPropertyOptional({
    description: 'Client ID (required for post-body auth or jwt-bearer grant)',
    example: 'app_01JXXXXXXXXX',
  })
  @IsOptional()
  @IsString()
  client_id?: string;

  @ApiPropertyOptional({
    description: 'Client secret (for client_credentials with post-body auth)',
    example: 'hs_secret_xxxxxxxx',
  })
  @IsOptional()
  @IsString()
  client_secret?: string;

  @ApiPropertyOptional({
    description: 'JWT assertion (for jwt-bearer grant type)',
  })
  @IsOptional()
  @IsString()
  assertion?: string;

  @ApiPropertyOptional({
    description: `Space-delimited list of requested scopes. Available scopes: ${getAllScopes().join(', ')}`,
    example: 'FHIR.R4/Patient.read FHIR.R4/Observation.read',
  })
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional({
    description: 'Authorization code (for authorization_code grant type)',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Redirect URI (must match the one used in the authorize request)',
  })
  @IsOptional()
  @IsString()
  redirect_uri?: string;

  @ApiPropertyOptional({
    description: 'PKCE code verifier (for authorization_code grant with S256 challenge)',
  })
  @IsOptional()
  @IsString()
  code_verifier?: string;
}

export class IntrospectRequestDto {
  @ApiProperty({ description: 'The token to introspect' })
  @IsString()
  token!: string;

  @ApiPropertyOptional({
    description: 'Hint about the token type (RFC 7662 S2.1)',
    enum: ['access_token', 'refresh_token'],
  })
  @IsOptional()
  @IsString()
  token_type_hint?: string;
}

export class RevokeRequestDto {
  @ApiProperty({ description: 'The token to revoke' })
  @IsString()
  token!: string;

  @ApiPropertyOptional({
    description: 'Hint about the token type (RFC 7009 S2.1)',
    enum: ['access_token', 'refresh_token'],
  })
  @IsOptional()
  @IsString()
  token_type_hint?: string;
}

// ─── Response DTOs ───────────────────────────────────────

export class TokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJSUzM4NCIs...' })
  access_token!: string;

  @ApiProperty({ example: 'Bearer' })
  token_type!: string;

  @ApiProperty({ example: 3600, description: 'Token lifetime in seconds' })
  expires_in!: number;

  @ApiProperty({ example: 'patient/*.read', description: 'Granted scopes' })
  scope!: string;
}

export class IntrospectResponseDto {
  @ApiProperty({ example: true })
  active!: boolean;

  @ApiPropertyOptional({ example: 'app-id-123' })
  sub?: string;

  @ApiPropertyOptional({ example: 'app_01JXXXXXXXXX' })
  client_id?: string;

  @ApiPropertyOptional({ example: 'patient/*.read' })
  scope?: string;

  @ApiPropertyOptional({ example: 'http://localhost:3002' })
  iss?: string;

  @ApiPropertyOptional({ example: 1700000000 })
  exp?: number;

  @ApiPropertyOptional({ example: 1699996400 })
  iat?: number;

  @ApiPropertyOptional({ example: 'Bearer' })
  token_type?: string;

  @ApiPropertyOptional({ description: 'List of EHRs this app has access to', example: ['epic', 'cerner'] })
  ehr_access?: string[];
}

export class OAuthErrorDto {
  @ApiProperty({ example: 'invalid_client' })
  error!: string;

  @ApiProperty({ example: 'Unknown client' })
  error_description!: string;
}
