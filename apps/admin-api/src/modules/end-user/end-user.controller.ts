import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../../guards/session.guard';
import { RolesGuard, Roles } from '../../guards/roles.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AllowTokenTypes } from '../../decorators/auth.decorator';
import { EndUserService } from './end-user.service';
import {
  AllowedAppUserDto,
  CreateEndUserDto,
  EndUserDetailDto,
  EndUserSummaryDto,
  ExternalIdentityInputDto,
  GrantAppAccessDto,
  GrantSiteAccessDto,
} from './end-user.dto';

interface OperatorIdentity {
  id: string;
  email: string;
  orgId: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

@ApiTags('End Users')
@ApiBearerAuth()
@AllowTokenTypes('session')
@UseGuards(SessionGuard, RolesGuard)
@Controller()
export class EndUserController {
  constructor(private readonly service: EndUserService) {}

  // ─── List ────────────────────────────────────────────────────────────

  @Get('admin/end-users')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: "List end-users in the operator's organization" })
  @ApiQuery({ name: 'q', required: false, description: 'Search by email/name/NPI' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'ACTIVE', 'DISABLED'] })
  @ApiQuery({ name: 'appId', required: false, description: 'Filter to users with access to a given app' })
  @ApiResponse({ status: 200, type: [EndUserSummaryDto] })
  list(
    @CurrentUser() user: OperatorIdentity,
    @Query('q') q?: string,
    @Query('status') status?: 'PENDING' | 'ACTIVE' | 'DISABLED',
    @Query('appId') appId?: string,
  ): Promise<EndUserSummaryDto[]> {
    return this.service.list(user.orgId, { search: q, status, appId });
  }

  // ─── Detail ──────────────────────────────────────────────────────────

  @Get('admin/end-users/:id')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Get end-user detail (apps, sites, external identities)' })
  @ApiResponse({ status: 200, type: EndUserDetailDto })
  detail(@CurrentUser() user: OperatorIdentity, @Param('id') id: string): Promise<EndUserDetailDto> {
    return this.service.detail(user.orgId, id);
  }

  // ─── Create / invite ─────────────────────────────────────────────────

  @Post('admin/end-users')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Invite a new end-user; grants apps + (optional) sites; sends invite email' })
  @ApiResponse({ status: 201, type: EndUserDetailDto })
  create(@CurrentUser() user: OperatorIdentity, @Body() body: CreateEndUserDto): Promise<EndUserDetailDto> {
    const inviterName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    return this.service.create(user.orgId, user.id, inviterName, body);
  }

  // ─── App access grant/revoke ─────────────────────────────────────────

  @Post('admin/end-users/:id/access/apps/:appId')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Grant end-user access to an application' })
  grantApp(
    @CurrentUser() user: OperatorIdentity,
    @Param('id') id: string,
    @Param('appId') appId: string,
    @Body() body: GrantAppAccessDto,
  ) {
    return this.service.grantApp(user.orgId, id, appId, body.accessLevel, user.id);
  }

  @Delete('admin/end-users/:id/access/apps/:appId')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Revoke end-user access to an application' })
  revokeApp(@CurrentUser() user: OperatorIdentity, @Param('id') id: string, @Param('appId') appId: string) {
    return this.service.revokeApp(user.orgId, id, appId, user.id);
  }

  // ─── Site access grant/revoke ────────────────────────────────────────

  @Post('admin/end-users/:id/access/sites/:siteId')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Grant end-user access to a specific site (narrows app-level access)' })
  grantSite(
    @CurrentUser() user: OperatorIdentity,
    @Param('id') id: string,
    @Param('siteId') siteId: string,
    @Body() body: GrantSiteAccessDto,
  ) {
    return this.service.grantSite(user.orgId, id, siteId, body.accessLevel, user.id);
  }

  @Delete('admin/end-users/:id/access/sites/:siteId')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Revoke end-user access to a specific site' })
  revokeSite(@CurrentUser() user: OperatorIdentity, @Param('id') id: string, @Param('siteId') siteId: string) {
    return this.service.revokeSite(user.orgId, id, siteId);
  }

  // ─── External-identity bindings (SMART standalone) ──────────────────

  @Post('admin/end-users/:id/external-identities')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Bind an EHR provider FHIR ID to an end-user (for SMART standalone match)' })
  bindExternalIdentity(
    @CurrentUser() user: OperatorIdentity,
    @Param('id') id: string,
    @Body() body: ExternalIdentityInputDto,
  ) {
    return this.service.bindExternalIdentity(user.orgId, id, body.ehrName, body.fhirId);
  }

  @Delete('admin/end-users/:id/external-identities/:ehrName/:fhirId')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Unbind an EHR provider FHIR ID from an end-user' })
  unbindExternalIdentity(
    @CurrentUser() user: OperatorIdentity,
    @Param('id') id: string,
    @Param('ehrName') ehrName: string,
    @Param('fhirId') fhirId: string,
  ) {
    // fhirId arrives URL-encoded ("Practitioner%2F12345"); decode for the service layer.
    return this.service.unbindExternalIdentity(user.orgId, id, ehrName, decodeURIComponent(fhirId));
  }

  // ─── Per-app allowed users (powers the per-app End Users tab) ───────

  @Get('admin/applications/:appId/end-users')
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'List end-users with access to a given application' })
  @ApiResponse({ status: 200, type: [AllowedAppUserDto] })
  listAllowedAppUsers(
    @CurrentUser() user: OperatorIdentity,
    @Param('appId') appId: string,
  ): Promise<AllowedAppUserDto[]> {
    return this.service.listAllowedAppUsers(user.orgId, appId);
  }
}
