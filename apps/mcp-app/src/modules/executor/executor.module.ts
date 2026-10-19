import { Module } from '@nestjs/common';
import { ExecutorService } from './executor.service';
import { SessionContextService } from './session-context.service';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [CatalogModule],
  providers: [ExecutorService, SessionContextService],
  exports: [ExecutorService, SessionContextService],
})
export class ExecutorModule {}
