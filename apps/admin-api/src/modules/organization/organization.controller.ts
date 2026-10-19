import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiPropertyOptional, ApiResponse } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { db } from '@hs/infra';
import { RolesGuard, Roles } from '../../guards/roles.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AllowTokenTypes } from '../../decorators/auth.decorator';
import { OrganizationDto } from '../../dto/response.dto';

class UpdateOrgDto {
  @ApiPropertyOptional({ description: 'Organization name', example: 'Acme Health' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Email domain for auto-join', example: 'acmehealth.com' })
  @IsString()
  @IsOptional()
  domain?: string;
}

@ApiTags('Organization')
@ApiBearerAuth()
@Controller('organizations')
@AllowTokenTypes('session')
export class OrganizationController {
  @Get('me')
  @ApiOperation({ summary: 'Get current organization' })
  @ApiResponse({ status: 200, type: OrganizationDto })
  async getMyOrganization(@CurrentUser() user: any) {
    const prisma = db.getClient();
    return prisma.organization.findUnique({
      where: { id: user.orgId },
      include: { _count: { select: { users: true, applications: true } } },
    });
  }

  @Patch('me')
  @UseGuards(RolesGuard)
  @Roles('OWNER')
  @ApiOperation({ summary: 'Update organization (OWNER only)' })
  @ApiResponse({ status: 200, type: OrganizationDto })
  async updateOrganization(@Body() body: UpdateOrgDto, @CurrentUser() user: any) {
    const prisma = db.getClient();
    return prisma.organization.update({
      where: { id: user.orgId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.domain && { domain: body.domain }),
      },
    });
  }
}
