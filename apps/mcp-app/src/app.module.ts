import { Module } from '@nestjs/common';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ExecutorModule } from './modules/executor/executor.module';
import { TransportsModule } from './modules/transports/transports.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [CatalogModule, ExecutorModule, TransportsModule, HealthModule],
})
export class AppModule {}
