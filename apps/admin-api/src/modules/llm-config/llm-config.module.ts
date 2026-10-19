import { Module } from '@nestjs/common';
import { LlmConfigController } from './llm-config.controller';

@Module({
  controllers: [LlmConfigController],
})
export class LlmConfigModule {}
