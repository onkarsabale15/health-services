import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator';
import { cache, db, httpClient } from '@hs/infra';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheckResponseDto } from '../../dto';

const ADMIN_API_URL = process.env.ADMIN_API_URL || 'http://localhost:3002';

type ComponentStatus = 'up' | 'down';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check (root)' })
  @ApiResponse({ status: 200, description: 'Service is healthy', type: HealthCheckResponseDto })
  @ApiResponse({ status: 503, description: 'Service is unhealthy', type: HealthCheckResponseDto })
  checkRoot() {
    return this.check();
  }

  @Get('health')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy', type: HealthCheckResponseDto })
  @ApiResponse({ status: 503, description: 'Service is unhealthy', type: HealthCheckResponseDto })
  async check() {
    // Liveness = bridge-api's OWN infrastructure (DB + Redis). The orchestrator
    // pings this to decide whether to keep or restart the instance, so ONLY
    // things bridge-api itself owns may fail it. A failed own-infra check throws
    // ServiceUnavailableException (503) via Terminus.
    const result = await this.health.check([() => this.checkDb(), () => this.checkRedis()]);

    // Downstream dependencies are probed best-effort and REPORTED, never fatal.
    // A peer (admin-api) being down must not cascade into bridge-api being
    // marked unhealthy and restarted — it surfaces as `degraded` instead, while
    // the endpoint still returns 200.
    const dependencies: Record<string, { status: ComponentStatus }> = {
      'admin-api': { status: await this.probeAdminApi() },
    };
    const degraded = Object.entries(dependencies)
      .filter(([, v]) => v.status !== 'up')
      .map(([name]) => name);

    return {
      service: 'bridge-api',
      ...result,
      ...(degraded.length > 0 ? { degraded } : {}),
      dependencies,
    };
  }

  private async checkDb() {
    const isHealthy = await db.isHealthy().catch(() => false);
    return { database: { status: (isHealthy ? 'up' : 'down') as ComponentStatus } };
  }

  private async checkRedis() {
    const isHealthy = await cache.isHealthy().catch(() => false);
    return { redis: { status: (isHealthy ? 'up' : 'down') as ComponentStatus } };
  }

  /** Best-effort reachability probe of admin-api. Never throws — returns a status. */
  private async probeAdminApi(): Promise<ComponentStatus> {
    try {
      const response = await httpClient.request<unknown>({
        url: `${ADMIN_API_URL}/health`,
        method: 'get',
        timeout: 5000,
      });
      return response.status >= 200 && response.status < 300 ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
