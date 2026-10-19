import {
  Controller,
  Get,
  Post,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { db } from '@hs/infra';
import { SessionGuard } from '../../guards/session.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserInfoResponseDto } from './userinfo.dto';

// ─── /oauth/userinfo (OIDC Core §5.3) ───────────────────────────────────────
//
// Returns OIDC standard claims for the user identified by a Bearer access
// token. Authenticated via SessionGuard — a session JWT (`token_type:
// 'session'`, `aud: ${issuer}/admin`) is the only token type with a
// user-identity `sub`. API M2M tokens have `sub = applicationId` and are
// rejected here (the guard handles token-type enforcement; we additionally
// 403 on disabled accounts after the guard runs).
//
// Per spec, the endpoint accepts both GET and POST. We support both for
// interop with older OIDC clients that prefer POST.

@ApiTags('OAuth 2.0')
@Controller('oauth')
@ApiBearerAuth()
@UseGuards(SessionGuard)
export class UserInfoController {
  @Get('userinfo')
  @ApiOperation({ summary: 'OIDC UserInfo (GET) — claims for the bearer access token' })
  @ApiResponse({ status: 200, description: 'OIDC UserInfo claims' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'User account is disabled' })
  async getUserInfo(
    @CurrentUser() user: { id: string; email: string; orgId: string; role: string },
  ): Promise<UserInfoResponseDto> {
    return this.resolveUserInfo(user.id);
  }

  @Post('userinfo')
  @ApiOperation({ summary: 'OIDC UserInfo (POST) — claims for the bearer access token' })
  async postUserInfo(
    @CurrentUser() user: { id: string; email: string; orgId: string; role: string },
  ): Promise<UserInfoResponseDto> {
    return this.resolveUserInfo(user.id);
  }

  private async resolveUserInfo(userId: string): Promise<UserInfoResponseDto> {
    if (!userId) {
      // Guard should already reject this — defense-in-depth in case a non-session
      // token sneaks through with a different shape.
      throw new UnauthorizedException('Token has no subject');
    }

    const prisma = db.getClient();
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!dbUser) throw new NotFoundException('User not found');
    if (dbUser.status !== 'ACTIVE') throw new ForbiddenException('User account is disabled');

    const fullName = [dbUser.firstName, dbUser.lastName].filter(Boolean).join(' ') || undefined;

    return {
      sub: dbUser.id,
      email: dbUser.email,
      email_verified: dbUser.emailVerified,
      name: fullName,
      given_name: dbUser.firstName,
      family_name: dbUser.lastName,
      updated_at: Math.floor(dbUser.updatedAt.getTime() / 1000),
      organizations: [
        {
          id: dbUser.organizationId,
          name: dbUser.organization.name,
          role: dbUser.role,
        },
      ],
    };
  }
}
