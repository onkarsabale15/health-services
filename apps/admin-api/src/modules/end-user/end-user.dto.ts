import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ACCESS_LEVELS, END_USER_STATUSES, type AccessLevel, type EndUserStatus } from '@hs/config';
// END_USER_STATUSES kept here for response DTO enum decoration; it's no longer
// used as a request input now that admin can't update the status field.

export class ExternalIdentityInputDto {
  @ApiProperty({ example: 'cerner' })
  @IsString()
  @MaxLength(50)
  ehrName!: string;

  @ApiProperty({ example: 'Practitioner/12345' })
  @IsString()
  @MaxLength(200)
  fhirId!: string;
}

// ─── DTOs ───────────────────────────────────────────────────────────────────

export class CreateEndUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  npi?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialty?: string;

  /** Application IDs to grant access to on creation. Triggers an invite email summarizing them. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  applicationIds?: string[];

  /** Optional site narrowing. Sites are validated against the application's accessible sites. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  siteIds?: string[];

  /**
   * Optional pre-bindings of EHR provider FHIR IDs to this EndUser. Useful
   * for SMART standalone launches where the EHR vouches for identity by FHIR
   * ID without surfacing email — bridge's resolver will hit the
   * (ehrName, fhirId) cache directly on first launch.
   */
  @ApiPropertyOptional({ type: [ExternalIdentityInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalIdentityInputDto)
  externalIdentities?: ExternalIdentityInputDto[];
}

export class GrantAppAccessDto {
  @ApiProperty({ enum: ACCESS_LEVELS })
  @IsEnum(ACCESS_LEVELS)
  accessLevel!: AccessLevel;
}

export class GrantSiteAccessDto {
  @ApiProperty({ enum: ACCESS_LEVELS })
  @IsEnum(ACCESS_LEVELS)
  accessLevel!: AccessLevel;
}

export class EndUserSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() emailVerified!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) firstName?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) lastName?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) npi?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) specialty?: string | null;
  @ApiProperty({ enum: END_USER_STATUSES }) status!: EndUserStatus;
  @ApiPropertyOptional({ type: String, nullable: true }) organizationId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) lastLoginAt?: string | null;
  @ApiProperty() appsCount!: number;
}

export class EndUserAppAccessDto {
  @ApiProperty() applicationId!: string;
  @ApiProperty() applicationName!: string;
  @ApiProperty({ enum: ACCESS_LEVELS }) accessLevel!: AccessLevel;
  @ApiProperty() grantSource!: string;
  @ApiProperty() grantedAt!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) grantedById?: string | null;
}

export class EndUserSiteAccessDto {
  @ApiProperty() siteId!: string;
  @ApiProperty() siteName!: string;
  @ApiProperty() applicationId!: string;
  @ApiProperty() applicationName!: string;
  @ApiProperty({ enum: ACCESS_LEVELS }) accessLevel!: AccessLevel;
  @ApiProperty() grantedAt!: string;
}

export class EndUserExternalIdentityDto {
  @ApiProperty() ehrName!: string;
  @ApiProperty() fhirId!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) emailAtSeen?: string | null;
  @ApiProperty() firstSeenAt!: string;
  @ApiProperty() lastSeenAt!: string;
}

export class EndUserDetailDto extends EndUserSummaryDto {
  @ApiProperty({ type: [EndUserAppAccessDto] }) apps!: EndUserAppAccessDto[];
  @ApiProperty({ type: [EndUserSiteAccessDto] }) sites!: EndUserSiteAccessDto[];
  @ApiProperty({ type: [EndUserExternalIdentityDto] }) externalIdentities!: EndUserExternalIdentityDto[];
}

export class AllowedAppUserDto {
  @ApiProperty() endUserId!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) firstName?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) lastName?: string | null;
  @ApiProperty({ enum: ACCESS_LEVELS }) accessLevel!: AccessLevel;
  @ApiProperty() grantSource!: string;
  @ApiProperty() grantedAt!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) lastLoginAt?: string | null;
}
