import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { db } from '@hs/infra';
import { messaging } from '@hs/infra';
import { logger } from '@hs/observability';
import { RolesGuard, Roles } from '../../guards/roles.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AllowTokenTypes } from '../../decorators/auth.decorator';
import { ExecuteWorkflowDto } from './workflow.dto';
import {
  ExecuteResponseDto,
  PaginatedExecutionsDto,
  ExecutionDetailDto,
  ExecutionStepsDto,
  CancelExecutionResponseDto,
} from '../../dto/response.dto';

@Controller()
@AllowTokenTypes('session')
@ApiTags('Workflow Execution')
@ApiBearerAuth()
export class WorkflowExecutionController {
  // ─── Trigger Execution ──────────────────────────────────────────

  @Post('applications/:appId/workflows/:workflowId/execute')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Trigger async workflow execution via Kafka' })
  @ApiResponse({ status: 201, description: 'Execution queued', type: ExecuteResponseDto })
  async execute(
    @Param('appId') appId: string,
    @Param('workflowId') workflowId: string,
    @Body() body: ExecuteWorkflowDto,
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();

    // Verify application + org boundary
    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true, organizationId: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    // Verify workflow exists and is active
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, applicationId: appId, isActive: true, status: 'ACTIVE' },
    });
    if (!workflow) {
      throw new NotFoundException('Workflow not found or not active');
    }

    // Create execution record with PENDING status
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId,
        status: 'PENDING',
        triggerInput: body.triggerInput ?? {},
        startedAt: new Date(),
      },
    });

    // Publish to Kafka for the workflow-executor to pick up
    await messaging.publishOne(
      'workflow.execute',
      {
        executionId: execution.id,
        workflowId,
        applicationId: appId,
        organizationId: app.organizationId,
        triggerInput: body.triggerInput ?? {},
        triggeredBy: user.id,
        triggeredAt: new Date().toISOString(),
      },
      execution.id,
    );

    logger.info('Workflow execution queued', {
      executionId: execution.id,
      workflowId,
      applicationId: appId,
      userId: user.id,
    });

    return { executionId: execution.id, status: 'PENDING' };
  }

  // ─── List Executions ────────────────────────────────────────────

  @Get('applications/:appId/executions')
  @ApiOperation({ summary: 'List executions for an application' })
  @ApiResponse({ status: 200, type: PaginatedExecutionsDto })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'workflowId', required: false, type: String })
  async listExecutions(
    @Param('appId') appId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('workflowId') workflowId?: string,
    @CurrentUser() user?: any,
  ) {
    const prisma = db.getClient();
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit || '50', 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Verify application + org boundary
    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    const where: Record<string, any> = {
      workflow: { applicationId: appId },
    };
    if (workflowId) {
      where.workflowId = workflowId;
    }

    const [executions, total] = await Promise.all([
      prisma.workflowExecution.findMany({
        where,
        select: {
          id: true,
          workflowId: true,
          status: true,
          startedAt: true,
          completedAt: true,
          durationMs: true,
          createdAt: true,
          workflow: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.workflowExecution.count({ where }),
    ]);

    return {
      data: executions.map((e) => ({
        id: e.id,
        workflowId: e.workflowId,
        workflowName: e.workflow.name,
        status: e.status,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
        durationMs: e.durationMs,
        createdAt: e.createdAt,
      })),
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  // ─── Get Execution Detail ──────────────────────────────────────

  @Get('applications/:appId/executions/:execId')
  @ApiOperation({ summary: 'Get execution status and output' })
  @ApiResponse({ status: 200, type: ExecutionDetailDto })
  async getExecution(@Param('appId') appId: string, @Param('execId') execId: string, @CurrentUser() user: any) {
    const prisma = db.getClient();

    // Verify application + org boundary
    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    const execution = await prisma.workflowExecution.findFirst({
      where: {
        id: execId,
        workflow: { applicationId: appId },
      },
      include: {
        workflow: { select: { name: true } },
      },
    });

    if (!execution) {
      throw new NotFoundException('Execution not found');
    }

    return {
      id: execution.id,
      workflowId: execution.workflowId,
      workflowName: execution.workflow.name,
      status: execution.status,
      triggerInput: execution.triggerInput,
      stepResults: execution.stepResults,
      output: execution.output,
      error: execution.error,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      durationMs: execution.durationMs,
      createdAt: execution.createdAt,
    };
  }

  // ─── Get Step Results ───────────────────────────────────────────

  @Get('applications/:appId/executions/:execId/steps')
  @ApiOperation({ summary: 'Get per-step results for canvas visualization' })
  @ApiResponse({ status: 200, type: ExecutionStepsDto })
  async getSteps(@Param('appId') appId: string, @Param('execId') execId: string, @CurrentUser() user: any) {
    const prisma = db.getClient();

    // Verify application + org boundary
    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    const execution = await prisma.workflowExecution.findFirst({
      where: {
        id: execId,
        workflow: { applicationId: appId },
      },
      select: {
        stepResults: true,
        status: true,
      },
    });

    if (!execution) {
      throw new NotFoundException('Execution not found');
    }

    return {
      status: execution.status,
      steps: execution.stepResults ?? [],
    };
  }

  // ─── Cancel Execution ──────────────────────────────────────────

  @Post('applications/:appId/executions/:execId/cancel')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Cancel a running or pending execution' })
  @ApiResponse({ status: 200, type: CancelExecutionResponseDto })
  async cancel(@Param('appId') appId: string, @Param('execId') execId: string, @CurrentUser() user: any) {
    const prisma = db.getClient();

    // Verify application + org boundary
    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    const execution = await prisma.workflowExecution.findFirst({
      where: {
        id: execId,
        workflow: { applicationId: appId },
      },
      select: { id: true, status: true },
    });

    if (!execution) {
      throw new NotFoundException('Execution not found');
    }

    if (execution.status !== 'RUNNING' && execution.status !== 'PENDING') {
      throw new BadRequestException('Can only cancel running or pending executions');
    }

    await prisma.workflowExecution.update({
      where: { id: execId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });

    logger.info('Workflow execution cancelled', {
      executionId: execId,
      applicationId: appId,
      userId: user.id,
    });

    return { id: execId, status: 'CANCELLED' };
  }
}
