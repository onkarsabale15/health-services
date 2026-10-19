import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// OIDC Core §5.1 standard claims plus an Health Services-specific
// `organizations` array. Other custom claims should be added behind
// scopes (the consent/scopes layer is deferred to full P2).

class OrganizationMembershipDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Role within the organization (OWNER | ADMIN | MEMBER).' })
  role!: string;
}

export class UserInfoResponseDto {
  @ApiProperty({ description: 'Stable subject identifier (User.id).' })
  sub!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ description: 'True when the email has been verified.' })
  email_verified!: boolean;

  @ApiPropertyOptional({ description: 'Full name (`given_name family_name`).' })
  name?: string;

  @ApiPropertyOptional()
  given_name?: string;

  @ApiPropertyOptional()
  family_name?: string;

  @ApiPropertyOptional({ description: 'Profile last-modified time as a Unix timestamp.' })
  updated_at?: number;

  @ApiProperty({
    type: [OrganizationMembershipDto],
    description: 'Organizations the user belongs to. Single entry today; multi-org follow-up.',
  })
  organizations!: OrganizationMembershipDto[];
}
