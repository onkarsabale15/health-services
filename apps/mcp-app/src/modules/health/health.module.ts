import { Controller, Get, Module } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { CatalogModule } from '../catalog/catalog.module';

@Controller('health')
class HealthController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  status() {
    return {
      status: 'ok',
      service: 'mcp-app',
      catalog: { tools: this.catalog.size() },
    };
  }
}

@Module({
  imports: [CatalogModule],
  controllers: [HealthController],
})
export class HealthModule {}
