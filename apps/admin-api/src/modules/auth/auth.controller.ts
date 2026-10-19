import { randomBytes } from 'crypto';
import { Controller, Post, Body, Header, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, MinLength, IsNotEmpty, Matches } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { db } from '@hs/infra';
import { cache } from '@hs/infra';
import { logger } from '@hs/observability';
import { signSessionToken } from './jwt.service';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Public, AllowTokenTypes } from '../../decorators/auth.decorator';
import { AdminCacheKeys } from '../../cache/cache-keys';
import { AdminCacheTTL } from '../../cache/cache-ttl';
import {
  SignUpResponseDto,
  SignInResponseDto,
  RefreshResponseDto,
  MessageResponseDto,
  SsoCodeResponseDto,
} from '../../dto/response.dto';

class SignUpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'secureP@ss1', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/, {
    message: 'Password must contain uppercase, lowercase, digit, and special character',
  })
  password!: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: 'Acme Health' })
  @IsString()
  @IsNotEmpty()
  organizationName!: string;
}

class SignInDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'secureP@ss1' })
  @IsString()
  password!: string;
}

class RefreshDto {
  @ApiProperty({ description: 'Opaque refresh token received from signin or token exchange' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

interface SessionPayload {
  sub: string;
  email: string;
  orgId: string;
  role: string;
}

async function createRefreshToken(payload: SessionPayload): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await cache.set(AdminCacheKeys.sessionRefresh(token), payload, AdminCacheTTL.SESSION_REFRESH);
  return token;
}

@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AuthController {
  @Post('signup')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5/min per email (identity tracker extracts email from body)
  @ApiOperation({ summary: 'Register a new user and optionally join existing org' })
  @ApiResponse({ status: 201, description: 'User created', type: SignUpResponseDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async signUp(@Body() body: SignUpDto) {
    const prisma = db.getClient();

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const domain = body.email.split('@')[1];
    const existingOrg = await prisma.organization.findUnique({ where: { domain } });

    const passwordHash = await bcrypt.hash(body.password, 12);

    if (existingOrg) {
      const user = await prisma.user.create({
        data: {
          email: body.email,
          passwordHash,
          firstName: body.firstName,
          lastName: body.lastName,
          organizationId: existingOrg.id,
          role: 'MEMBER',
          status: 'PENDING',
        },
      });

      logger.info('User created with PENDING status (existing org)', { userId: user.id, orgId: existingOrg.id });

      return {
        userId: user.id,
        organizationId: existingOrg.id,
        status: 'PENDING',
        message: 'Your account is pending approval by your organization admin.',
      };
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const org = await tx.organization.create({
        data: { name: body.organizationName, domain },
      });

      const user = await tx.user.create({
        data: {
          email: body.email,
          passwordHash,
          firstName: body.firstName,
          lastName: body.lastName,
          organizationId: org.id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });

      return { org, user };
    });

    const sessionPayload: SessionPayload = {
      sub: result.user.id,
      email: result.user.email,
      orgId: result.org.id,
      role: 'OWNER',
    };
    const token = await signSessionToken(sessionPayload);
    const refreshToken = await createRefreshToken(sessionPayload);

    logger.info('User and org created', { userId: result.user.id, orgId: result.org.id });

    return {
      userId: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      organizationId: result.org.id,
      organizationName: result.org.name,
      role: 'OWNER',
      status: 'ACTIVE',
      ...token,
      refreshToken,
    };
  }

  @Post('signin')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5/min per email (prevents brute-force per account)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiResponse({ status: 200, description: 'Session token returned', type: SignInResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async signIn(@Body() body: SignInDto) {
    const prisma = db.getClient();

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { organization: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'PENDING') {
      throw new UnauthorizedException('Account pending approval by organization admin');
    }

    if (user.status === 'DISABLED') {
      throw new UnauthorizedException('Account is disabled');
    }

    const sessionPayload: SessionPayload = {
      sub: user.id,
      email: user.email,
      orgId: user.organizationId,
      role: user.role,
    };
    const token = await signSessionToken(sessionPayload);
    const refreshToken = await createRefreshToken(sessionPayload);

    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      role: user.role,
      ...token,
      refreshToken,
    };
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30/min — no identity available, falls back to IP
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Sat, 01 Aug 2026 00:00:00 GMT')
  @Header('Link', '</oauth/token>; rel="successor-version"')
  @ApiOperation({ summary: 'DEPRECATED — Use POST /oauth/token with grant_type=refresh_token instead' })
  @ApiResponse({ status: 200, description: 'New access and refresh tokens', type: RefreshResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() body: RefreshDto) {
    const cacheKey = AdminCacheKeys.sessionRefresh(body.refreshToken);

    // Atomic get-and-delete prevents race condition (token reuse)
    const stored = await cache.getdel<SessionPayload>(cacheKey);

    if (!stored) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Verify user is still active
    const prisma = db.getClient();
    const user = await prisma.user.findUnique({ where: { id: stored.sub } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is no longer active');
    }

    // Issue new tokens with current user data
    const sessionPayload: SessionPayload = {
      sub: user.id,
      email: user.email,
      orgId: user.organizationId,
      role: user.role,
    };
    const token = await signSessionToken(sessionPayload);
    const refreshToken = await createRefreshToken(sessionPayload);

    return { ...token, refreshToken };
  }

  @Post('logout')
  @AllowTokenTypes('session')
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out', type: MessageResponseDto })
  async logout(@Body() body: RefreshDto) {
    await cache.del(AdminCacheKeys.sessionRefresh(body.refreshToken));
    return { message: 'Logged out' };
  }

  @Post('sso-code')
  @AllowTokenTypes('session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a short-lived SSO code for cross-app authentication' })
  @ApiResponse({ status: 200, description: 'SSO code issued', type: SsoCodeResponseDto })
  async createSsoCode(@CurrentUser() user: { id: string; email: string; orgId: string; role: string }) {
    const prisma = db.getClient();
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { organization: true },
    });

    if (!dbUser || dbUser.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active');
    }

    const code = randomBytes(32).toString('hex');
    await cache.set(
      AdminCacheKeys.ssoCode(code),
      {
        userId: dbUser.id,
        email: dbUser.email,
        emailVerified: dbUser.emailVerified,
        orgId: dbUser.organizationId,
        role: dbUser.role,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        organizationName: dbUser.organization.name,
      },
      AdminCacheTTL.SSO_CODE,
    );

    logger.info('SSO code issued', { userId: dbUser.id, orgId: dbUser.organizationId });

    return { sso_code: code };
  }
}
