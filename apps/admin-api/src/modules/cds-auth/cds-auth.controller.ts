import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { db } from '@hs/infra';
import { cache } from '@hs/infra';
import { mailer } from '@hs/mailer';
import { logger } from '@hs/observability';
import { Public } from '../../decorators/auth.decorator';
import { signCdsProviderToken } from '../auth/jwt.service';

const OTP_TTL = 600; // 10 minutes
const OTP_MAX_ATTEMPTS = 3;
const OTP_LENGTH = 6;

interface OtpEntry {
  otp: string;
  attempts: number;
  providerId: string;
}

@ApiTags('CDS Auth')
@Controller('cds')
export class CdsAuthController {
  // ── OTP Authentication (public) ───────────────────────────

  @Post('auth/request-otp')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 900000 } }) // 3 per 15min per IP
  @ApiOperation({ summary: 'Request OTP for CDS provider login' })
  async requestOtp(@Body() body: { email: string; applicationId: string }) {
    const { email, applicationId } = body;
    if (!email || !applicationId) throw new BadRequestException('email and applicationId are required');

    // Always return 200 regardless of provider existence (anti-enumeration)
    const provider = await db.getClient().cdsProvider.findFirst({
      where: { applicationId, email, isActive: true },
    });

    if (provider) {
      const otp = generateOtp();
      const key = `cds:otp:${applicationId}:${email}`;
      await cache.set(key, { otp, attempts: 0, providerId: provider.id } as OtpEntry, OTP_TTL);

      // Fire-and-forget — never block the request lane on email delivery.
      // Failures surface via Sentry / logs; the user simply re-requests an OTP.
      mailer
        .sendOtp(email, { code: otp, expiresInMinutes: Math.floor(OTP_TTL / 60) })
        .catch((err) => logger.warn('CDS OTP email send failed', { email, error: err?.message }));

      logger.info('CDS OTP requested', { applicationId, hasProvider: true });
    } else {
      logger.info('CDS OTP requested', { applicationId, hasProvider: false });
    }

    // Constant response regardless of provider existence
    return { message: 'If a matching account exists, a verification code has been sent.' };
  }

  @Post('auth/verify-otp')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute per IP
  @ApiOperation({ summary: 'Verify OTP and receive CDS provider JWT' })
  async verifyOtp(@Body() body: { email: string; applicationId: string; otp: string }) {
    const { email, applicationId, otp } = body;
    if (!email || !applicationId || !otp) throw new BadRequestException('email, applicationId, and otp are required');

    const key = `cds:otp:${applicationId}:${email}`;
    const entry = await cache.get<OtpEntry>(key);

    if (!entry) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // Check attempts
    if (entry.attempts >= OTP_MAX_ATTEMPTS) {
      await cache.del(key);
      throw new BadRequestException('Too many attempts. Please request a new code.');
    }

    // Verify OTP
    if (entry.otp !== otp) {
      entry.attempts++;
      await cache.set(key, entry, OTP_TTL);
      throw new BadRequestException('Incorrect verification code');
    }

    // Success — consume OTP atomically
    await cache.del(key);

    // Load provider details
    const provider = await db.getClient().cdsProvider.findUnique({
      where: { id: entry.providerId },
    });
    if (!provider || !provider.isActive) {
      throw new BadRequestException('Provider account is no longer active');
    }

    // Load app to get ehrName
    const app = await db.getClient().application.findUnique({
      where: { id: applicationId },
      select: { organizationId: true },
    });

    // Load site for ehrName
    let ehrName = 'system';
    if (provider.siteId) {
      const site = await db.getClient().ehrSiteConfig.findUnique({
        where: { id: provider.siteId },
        select: { ehrAccess: { select: { ehrName: true } } },
      });
      if (site?.ehrAccess?.ehrName) ehrName = site.ehrAccess.ehrName;
    }

    // Sign CDS provider JWT
    const { token, expiresIn } = await signCdsProviderToken({
      sub: provider.id,
      email: provider.email,
      applicationId,
      siteId: provider.siteId || undefined,
      firstName: provider.firstName,
      lastName: provider.lastName,
      npi: provider.npi || undefined,
      providerFhirId: provider.providerFhirId || undefined,
      ehrName,
    });

    logger.info('CDS provider authenticated via OTP', { providerId: provider.id, applicationId });

    return {
      token,
      expiresIn,
      provider: {
        id: provider.id,
        name: `${provider.firstName} ${provider.lastName}`,
        email: provider.email,
        npi: provider.npi,
      },
    };
  }

  // ── CDS Provider CRUD (admin-authenticated) ───────────────

  @Get('providers/:applicationId')
  @ApiOperation({ summary: 'List CDS providers for an application' })
  async listProviders(@Param('applicationId') applicationId: string) {
    return db.getClient().cdsProvider.findMany({
      where: { applicationId, isActive: true },
      orderBy: { lastName: 'asc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        npi: true,
        providerFhirId: true,
        specialty: true,
        siteId: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  @Post('providers/:applicationId')
  @ApiOperation({ summary: 'Register a CDS provider' })
  async createProvider(
    @Param('applicationId') applicationId: string,
    @Body()
    body: {
      email: string;
      firstName: string;
      lastName: string;
      npi?: string;
      providerFhirId?: string;
      specialty?: string;
      siteId?: string;
    },
  ) {
    if (!body.email || !body.firstName || !body.lastName) {
      throw new BadRequestException('email, firstName, and lastName are required');
    }

    // Get org from app
    const app = await db.getClient().application.findUnique({
      where: { id: applicationId },
      select: { organizationId: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    return db.getClient().cdsProvider.upsert({
      where: { applicationId_email: { applicationId, email: body.email } },
      create: {
        organizationId: app.organizationId,
        applicationId,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        npi: body.npi,
        providerFhirId: body.providerFhirId,
        specialty: body.specialty,
        siteId: body.siteId,
        isActive: true,
      },
      update: {
        firstName: body.firstName,
        lastName: body.lastName,
        npi: body.npi,
        providerFhirId: body.providerFhirId,
        specialty: body.specialty,
        siteId: body.siteId,
        isActive: true,
      },
    });
  }

  @Put('providers/:applicationId/:providerId')
  @ApiOperation({ summary: 'Update a CDS provider' })
  async updateProvider(
    @Param('applicationId') applicationId: string,
    @Param('providerId') providerId: string,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      npi?: string;
      providerFhirId?: string;
      specialty?: string;
      siteId?: string;
      isActive?: boolean;
    },
  ) {
    const provider = await db.getClient().cdsProvider.findFirst({
      where: { id: providerId, applicationId },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const data: Record<string, any> = {};
    if (body.firstName !== undefined) data.firstName = body.firstName;
    if (body.lastName !== undefined) data.lastName = body.lastName;
    if (body.npi !== undefined) data.npi = body.npi;
    if (body.providerFhirId !== undefined) data.providerFhirId = body.providerFhirId;
    if (body.specialty !== undefined) data.specialty = body.specialty;
    if (body.siteId !== undefined) data.siteId = body.siteId;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    return db.getClient().cdsProvider.update({ where: { id: providerId }, data });
  }

  @Delete('providers/:applicationId/:providerId')
  @ApiOperation({ summary: 'Deactivate a CDS provider' })
  async deleteProvider(@Param('applicationId') applicationId: string, @Param('providerId') providerId: string) {
    const provider = await db.getClient().cdsProvider.findFirst({
      where: { id: providerId, applicationId },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    await db.getClient().cdsProvider.update({
      where: { id: providerId },
      data: { isActive: false },
    });
    return { deactivated: true };
  }
}

function generateOtp(): string {
  return Array.from({ length: OTP_LENGTH }, () => Math.floor(Math.random() * 10)).join('');
}
