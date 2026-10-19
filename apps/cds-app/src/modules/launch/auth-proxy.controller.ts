import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { httpClient } from '@hs/infra';

/** Provider record returned by admin-api after OTP verification. */
export interface OtpProvider {
  fhirId?: string;
  firstName?: string;
  lastName?: string;
  npi?: string;
  siteId?: string;
}

/**
 * Proxies OTP auth requests to admin-api.
 * Avoids CORS issues (CDS frontend → CDS backend → admin-api).
 * Only forwards whitelisted fields — prevents injection.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthProxyController {
  constructor(private readonly config: ConfigService) {}

  @Post('request-otp')
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 per 15min per email
  @ApiOperation({ summary: 'Request OTP for provider login (proxied to admin-api)' })
  async requestOtp(@Body() body: { email?: string }) {
    if (!body.email) throw new BadRequestException('email is required');

    const applicationId = this.config.get<string>('app.cdsClientId');
    const adminUrl = this.config.get<string>('app.adminApiUrl');

    const response = await httpClient.request<{ message: string }>({
      url: `${adminUrl}/cds/auth/request-otp`,
      method: 'post',
      data: { email: body.email, applicationId },
      timeout: 5000,
    });

    // Only forward expected fields
    return { message: response.data?.message || 'Verification code sent if account exists.' };
  }

  @Post('verify-otp')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute per email
  @ApiOperation({ summary: 'Verify OTP and get provider JWT (proxied to admin-api)' })
  async verifyOtp(@Body() body: { email?: string; otp?: string }) {
    if (!body.email || !body.otp) throw new BadRequestException('email and otp are required');

    const applicationId = this.config.get<string>('app.cdsClientId');
    const adminUrl = this.config.get<string>('app.adminApiUrl');

    const response = await httpClient.request<{ token: string; expiresIn: number; provider: OtpProvider }>({
      url: `${adminUrl}/cds/auth/verify-otp`,
      method: 'post',
      data: { email: body.email, applicationId, otp: body.otp },
      timeout: 5000,
    });

    // Only forward expected fields
    return {
      token: response.data?.token,
      expiresIn: response.data?.expiresIn,
      provider: response.data?.provider,
    };
  }
}
