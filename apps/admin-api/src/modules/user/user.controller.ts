import { Controller, Get, Patch, Delete, Param, Query, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { db } from '@hs/infra';
import { logger } from '@hs/observability';
import { RolesGuard, Roles } from '../../guards/roles.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AllowTokenTypes } from '../../decorators/auth.decorator';
import { PaginatedUsersDto, MessageResponseDto, UserAppAccessDto } from '../../dto/response.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@AllowTokenTypes('session')
export class UserController {
  @Get()
  @ApiOperation({ summary: 'List organization users' })
  @ApiResponse({ status: 200, type: PaginatedUsersDto })
  async listUsers(@CurrentUser() user: any, @Query('page') page = '1', @Query('limit') limit = '50') {
    const prisma = db.getClient();
    const take = Math.min(parseInt(limit) || 50, 200);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const where = { organizationId: user.orgId };
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.user.count({ where }),
    ]);

    return { data, total, page: Math.max(parseInt(page) || 1, 1), limit: take };
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'List pending users awaiting approval' })
  @ApiResponse({ status: 200, type: PaginatedUsersDto })
  async listPendingUsers(@CurrentUser() user: any, @Query('page') page = '1', @Query('limit') limit = '50') {
    const prisma = db.getClient();
    const take = Math.min(parseInt(limit) || 50, 200);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const where = { organizationId: user.orgId, status: 'PENDING' as const };
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.user.count({ where }),
    ]);

    return { data, total, page: Math.max(parseInt(page) || 1, 1), limit: take };
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Approve a pending user' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async approveUser(@Param('id') id: string, @CurrentUser() user: any) {
    const prisma = db.getClient();
    const target = await prisma.user.findFirst({
      where: { id, organizationId: user.orgId, status: 'PENDING' },
    });
    if (!target) throw new BadRequestException('User not found or not pending');

    await prisma.user.update({ where: { id }, data: { status: 'ACTIVE' } });
    logger.info('User approved', { userId: id, approvedBy: user.id });
    return { message: 'User approved' };
  }

  @Patch(':id/disable')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Disable a user' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async disableUser(@Param('id') id: string, @CurrentUser() user: any) {
    if (id === user.id) throw new BadRequestException('Cannot disable yourself');
    const prisma = db.getClient();
    const target = await prisma.user.findFirst({
      where: { id, organizationId: user.orgId },
      select: { id: true },
    });
    if (!target) throw new BadRequestException('User not found');

    await prisma.user.update({
      where: { id: target.id },
      data: { status: 'DISABLED' },
    });
    return { message: 'User disabled' };
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles('OWNER')
  @ApiOperation({ summary: 'Change user role (OWNER only)' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async changeRole(@Param('id') id: string, @Body() body: { role: string }, @CurrentUser() user: any) {
    if (id === user.id) throw new BadRequestException('Cannot change your own role');
    if (!['ADMIN', 'MEMBER'].includes(body.role)) {
      throw new BadRequestException('Invalid role. Use ADMIN or MEMBER');
    }
    const prisma = db.getClient();
    const target = await prisma.user.findFirst({
      where: { id, organizationId: user.orgId },
      select: { id: true },
    });
    if (!target) throw new BadRequestException('User not found');

    await prisma.user.update({
      where: { id: target.id },
      data: { role: body.role as any },
    });
    return { message: `Role changed to ${body.role}` };
  }

  @Get(':userId/apps')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'List apps a user has access to' })
  async listUserApps(@Param('userId') userId: string, @CurrentUser() user: any) {
    const prisma = db.getClient();
    return prisma.userAppAccess.findMany({
      where: { userId, application: { organizationId: user.orgId } },
      include: { application: { select: { id: true, name: true, clientId: true } } },
    });
  }

  @Patch(':userId/apps/:appId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Grant or update user access to an app' })
  @ApiResponse({ status: 200, type: UserAppAccessDto })
  async grantAppAccess(
    @Param('userId') userId: string,
    @Param('appId') appId: string,
    @Body() body: { accessLevel?: string },
    @CurrentUser() user: any,
  ) {
    const level = body.accessLevel || 'READONLY';
    if (!['READONLY', 'FULL'].includes(level)) {
      throw new BadRequestException('accessLevel must be READONLY or FULL');
    }

    const prisma = db.getClient();

    // Verify user and app belong to same org
    const [targetUser, app] = await Promise.all([
      prisma.user.findFirst({ where: { id: userId, organizationId: user.orgId } }),
      prisma.application.findFirst({ where: { id: appId, organizationId: user.orgId } }),
    ]);
    if (!targetUser) throw new BadRequestException('User not found');
    if (!app) throw new BadRequestException('Application not found');

    // Cannot modify your own access
    if (userId === user.id) throw new BadRequestException('Cannot modify your own access');

    // Only OWNER can modify another OWNER's access
    if (targetUser.role === 'OWNER' && user.role !== 'OWNER') {
      throw new BadRequestException("Only the owner can modify another owner's access");
    }

    const result = await prisma.userAppAccess.upsert({
      where: { userId_applicationId: { userId, applicationId: appId } },
      create: { userId, applicationId: appId, accessLevel: level as any },
      update: { accessLevel: level as any },
    });

    logger.info('User app access granted', { userId, appId, accessLevel: level });
    return result;
  }

  @Delete(':userId/apps/:appId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Revoke user access to an app' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async revokeAppAccess(@Param('userId') userId: string, @Param('appId') appId: string, @CurrentUser() user: any) {
    const prisma = db.getClient();

    // Cannot revoke your own access
    if (userId === user.id) throw new BadRequestException('Cannot revoke your own access');

    // Verify app belongs to org
    const [app, targetUser] = await Promise.all([
      prisma.application.findFirst({ where: { id: appId, organizationId: user.orgId } }),
      prisma.user.findFirst({ where: { id: userId, organizationId: user.orgId } }),
    ]);
    if (!app) throw new BadRequestException('Application not found');
    if (!targetUser) throw new BadRequestException('User not found');

    // Only OWNER can revoke another OWNER's access
    if (targetUser.role === 'OWNER' && user.role !== 'OWNER') {
      throw new BadRequestException("Only the owner can revoke another owner's access");
    }

    await prisma.userAppAccess.deleteMany({
      where: { userId, applicationId: appId },
    });

    logger.info('User app access revoked', { userId, appId });
    return { message: 'Access revoked' };
  }
}
