import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowExecutionController } from './workflow-execution.controller';
import { InternalTokenController } from './internal-token.controller';

@Module({
  controllers: [WorkflowController, WorkflowExecutionController, InternalTokenController],
})
export class WorkflowModule {}
