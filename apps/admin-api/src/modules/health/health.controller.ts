import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { db } from '@hs/infra';
import { cache } from '@hs/infra';
import { Public } from '../../decorators/auth.decorator';

@ApiTags('Health')
@Controller()
@Public()
@SkipThrottle()
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check (root)' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  checkRoot() {
    return this.check();
  }

  @Get('health')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async check() {
    const result = await this.health.check([() => this.checkDatabase(), () => this.checkRedis()]);
    return { service: 'admin-api', ...result };
  }

  private async checkDatabase() {
    const isHealthy = await db.isHealthy();
    return {
      database: {
        status: isHealthy ? ('up' as const) : ('down' as const),
      },
    };
  }

  private async checkRedis() {
    const isHealthy = await cache.isHealthy();
    return {
      redis: {
        status: isHealthy ? ('up' as const) : ('down' as const),
      },
    };
  }
}
