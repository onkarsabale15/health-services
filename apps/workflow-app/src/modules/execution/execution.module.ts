import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { EhrClientService } from '../../services/ehr-client.service';
import { LlmClientService } from '../../services/llm-client.service';
import { TokenService } from '../../services/token.service';
import { MessageConsumerService } from '../../services/kafka-consumer.service';

@Module({
  providers: [ExecutionService, EhrClientService, LlmClientService, TokenService, MessageConsumerService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
