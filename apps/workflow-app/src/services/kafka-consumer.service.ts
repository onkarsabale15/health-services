import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { messaging, type ReceivedMessage } from '@hs/infra';
import { logger } from '@hs/observability';
import { ExecutionService } from '../modules/execution/execution.service';

interface WorkflowExecuteMessage {
  executionId: string;
  workflowId: string;
  applicationId: string;
  organizationId: string;
  triggerInput: Record<string, unknown>;
  triggeredBy: string;
  triggeredAt: string;
}

@Injectable()
export class MessageConsumerService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly executionService: ExecutionService) {}

  async onModuleInit(): Promise<void> {
    await messaging.subscribe<WorkflowExecuteMessage>(
      'workflow.execute',
      async (message: ReceivedMessage<WorkflowExecuteMessage>) => {
        const { executionId, workflowId, applicationId, triggerInput } = message.value;
        logger.info('Received workflow execution task', {
          executionId,
          workflowId,
          applicationId,
        });

        try {
          await this.executionService.executeWorkflow(executionId, workflowId, applicationId, triggerInput);
        } catch (error) {
          logger.error('Workflow execution failed', error instanceof Error ? error : new Error(String(error)), {
            executionId,
            workflowId,
          });
        }
      },
      { groupId: 'workflow-executors' },
    );

    logger.info('Message consumer subscribed to workflow.execute channel');
  }

  async onModuleDestroy(): Promise<void> {
    await messaging.disconnect();
  }
}
