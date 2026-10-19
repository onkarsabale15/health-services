import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ExecutorModule } from '../executor/executor.module';
import { McpAuthService } from './auth';
import { HttpTransportController } from './http.controller';
import { McpServerService } from './mcp-server.service';

@Module({
  imports: [CatalogModule, ExecutorModule],
  controllers: [HttpTransportController],
  providers: [McpAuthService, McpServerService],
})
export class TransportsModule {}
