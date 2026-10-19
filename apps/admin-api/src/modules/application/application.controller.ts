import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { RolesGuard, Roles } from '../../guards/roles.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AllowTokenTypes } from '../../decorators/auth.decorator';
import {
  PaginatedApplicationsDto,
  CreateApplicationResponseDto,
  ApplicationDto,
  RotateSecretResponseDto,
  JwksUpdateResponseDto,
  MessageResponseDto,
} from '../../dto/response.dto';
import { ApplicationService, CreateApplicationDto, UpdateApplicationDto } from './application.service';

@ApiTags('Applications')
@ApiBearerAuth()
@Controller('applications')
@AllowTokenTypes('session')
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Get()
  @ApiOperation({ summary: 'List organization applications (filtered by user access for MEMBER role)' })
  @ApiResponse({ status: 200, type: PaginatedApplicationsDto })
  async listApplications(@CurrentUser() user: any, @Query('page') page = '1', @Query('limit') limit = '50') {
    return this.applicationService.listApplications(user, parseInt(page) || 1, parseInt(limit) || 50);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a new application' })
  @ApiResponse({
    status: 201,
    description: 'Application created with clientId and clientSecret',
    type: CreateApplicationResponseDto,
  })
  async createApplication(@Body() body: CreateApplicationDto, @CurrentUser() user: any) {
    return this.applicationService.createApplication(body, user);
  }

  @Get(':id/detail')
  @ApiOperation({ summary: 'Get application with EHR access, user access, and org users in one call' })
  async getApplicationDetail(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicationService.getApplicationDetail(id, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application details' })
  @ApiResponse({ status: 200, type: ApplicationDto })
  async getApplication(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicationService.getApplication(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update application' })
  @ApiResponse({ status: 200, type: ApplicationDto })
  async updateApplication(@Param('id') id: string, @Body() body: UpdateApplicationDto, @CurrentUser() user: any) {
    return this.applicationService.updateApplication(id, body, user);
  }

  @Post(':id/rotate-secret')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Rotate client secret' })
  @ApiResponse({ status: 200, type: RotateSecretResponseDto })
  async rotateSecret(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicationService.rotateSecret(id, user);
  }

  @Patch(':id/jwks')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Set JWKS via public URL (for JWT assertion auth)' })
  @ApiResponse({ status: 200, type: JwksUpdateResponseDto })
  async updateJwks(@Param('id') id: string, @Body() body: { jwksUri: string }, @CurrentUser() user: any) {
    return this.applicationService.updateJwks(id, body.jwksUri, user);
  }

  @Post(':id/jwks/refresh')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Re-fetch JWKS from the stored URI' })
  @ApiResponse({ status: 200, type: JwksUpdateResponseDto })
  async refreshJwks(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicationService.refreshJwks(id, user);
  }

  @Delete(':id/jwks')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Remove JWKS configuration' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async removeJwks(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicationService.removeJwks(id, user);
  }

  @Post(':id/enable')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Re-enable a disabled application' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async enableApplication(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicationService.enableApplication(id, user);
  }

  @Get(':id/access')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'List users with access to this application' })
  async listAppAccess(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicationService.listAppAccess(id, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Disable application' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async deleteApplication(@Param('id') id: string, @CurrentUser() user: any) {
    return this.applicationService.disableApplication(id, user);
  }
}
