import { Injectable } from '@nestjs/common';
import { db } from '@hs/infra';
import { logger } from '@hs/observability';
import {
  DagExecutor,
  type WorkflowDefinition,
  type NodeHandlers,
  type ExecutionContext,
  type StepResult,
} from '../../engine';
import { EhrClientService } from '../../services/ehr-client.service';
import { LlmClientService } from '../../services/llm-client.service';
import { TokenService } from '../../services/token.service';

const EXECUTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class ExecutionService {
  constructor(
    private readonly ehrClientService: EhrClientService,
    private readonly llmClient: LlmClientService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Execute a workflow by ID. Called by the Kafka consumer.
   * Loads the workflow from DB, runs the DAG, and writes results back.
   * Idempotent — skips if execution is not in PENDING status.
   */
  async executeWorkflow(
    executionId: string,
    workflowId: string,
    applicationId: string,
    triggerInput: Record<string, unknown>,
  ): Promise<void> {
    const prisma = db.getClient();

    // Idempotency: only execute if status is PENDING
    const execution = await prisma.workflowExecution.findFirst({
      where: { id: executionId },
      select: { status: true },
    });

    if (!execution) {
      logger.warn('Execution record not found, skipping', { executionId });
      return;
    }

    if (execution.status !== 'PENDING') {
      logger.warn('Execution not in PENDING status, skipping', {
        executionId,
        currentStatus: execution.status,
      });
      return;
    }

    // Load workflow definition
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, applicationId, isActive: true },
    });

    if (!workflow) {
      logger.error('Workflow not found or inactive', undefined, { workflowId, applicationId });
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          error: 'Workflow not found or inactive',
          completedAt: new Date(),
        },
      });
      return;
    }

    await this.runExecution(executionId, workflow, applicationId, triggerInput);
  }

  /**
   * Run workflow execution: update status, build handlers, execute DAG, write results.
   */
  private async runExecution(
    executionId: string,
    workflow: any,
    applicationId: string,
    triggerInput: Record<string, unknown>,
  ): Promise<void> {
    const startMs = Date.now();
    const prisma = db.getClient();

    try {
      // Update status to RUNNING
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: { status: 'RUNNING' },
      });

      const definition: WorkflowDefinition = {
        nodes: workflow.nodes as any[],
        edges: workflow.edges as any[],
        ...(workflow.config as any),
      };

      // Build node handlers (DIP — injected into pure engine)
      const handlers = this.buildHandlers(applicationId, definition);

      // Build execution context
      const context: ExecutionContext = {
        executionId,
        workflowId: workflow.id,
        applicationId,
        triggerInput,
        variables: definition.variables ?? {},
        stepResults: new Map(),
        status: 'pending',
        startedAt: new Date(),
      };

      // Execute with timeout
      const executor = new DagExecutor(definition, handlers, context);
      const result = await Promise.race([executor.execute(), this.timeout(EXECUTION_TIMEOUT_MS)]);

      // Convert Map to serializable array for DB storage
      const stepResultsArray = this.serializeStepResults(context.stepResults);

      const durationMs = Date.now() - startMs;

      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: context.status === 'failed' ? 'FAILED' : 'COMPLETED',
          stepResults: stepResultsArray,
          output: result,
          completedAt: new Date(),
          durationMs,
        },
      });

      logger.info('Workflow execution completed', {
        executionId,
        workflowId: workflow.id,
        status: context.status,
        durationMs,
        stepsCompleted: stepResultsArray.length,
      });
    } catch (error: unknown) {
      const durationMs = Date.now() - startMs;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Workflow execution failed', error instanceof Error ? error : new Error(errorMessage), {
        executionId,
        workflowId: workflow.id,
      });

      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          error: errorMessage,
          completedAt: new Date(),
          durationMs,
        },
      });
    }
  }

  private buildHandlers(applicationId: string, _definition: WorkflowDefinition): NodeHandlers {
    return {
      executeRawEhr: async (connectionId, ehrName, methodName, args) => {
        const { vendorService, config } = await this.ehrClientService.getRawClient(connectionId);

        if (typeof (vendorService as any)[methodName] !== 'function') {
          throw new Error(`Method ${methodName} not supported by ${ehrName} service`);
        }

        // Dynamically call the raw method (e.g., athena.searchPatients(config, ...args))
        // Most methods expect (config, params, data) or (config, id, data)
        const response = await (vendorService as any)[methodName](config, ...args);

        // Return only the data payload to the workflow context
        return response.data;
      },

      llmChat: async (provider, model, systemPrompt, userPrompt, options) => {
        return this.llmClient.chat(applicationId, provider, model, systemPrompt, userPrompt, options);
      },
    };
  }

  private serializeStepResults(stepResults: Map<string, StepResult>): any[] {
    return Array.from(stepResults.values()).map((result) => ({
      nodeId: result.nodeId,
      status: result.status,
      output: result.output,
      error: result.error,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
    }));
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Workflow execution timed out after ${ms / 1000}s`)), ms),
    );
  }
}
