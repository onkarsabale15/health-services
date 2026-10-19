import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { db } from '@hs/infra';
import { logger } from '@hs/observability';
import { RolesGuard, Roles } from '../../guards/roles.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AllowTokenTypes } from '../../decorators/auth.decorator';
import { CreateWorkflowDto, UpdateWorkflowDto, CreateFromTemplateDto } from './workflow.dto';
import { WorkflowDto, PaginatedWorkflowsDto, WorkflowTemplateDto, MessageResponseDto } from '../../dto/response.dto';

@Controller()
@AllowTokenTypes('session')
@ApiBearerAuth()
export class WorkflowController {
  // ─── Create Workflow ────────────────────────────────────────────

  @Post('applications/:appId/workflows')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiTags('Workflows')
  @ApiOperation({ summary: 'Create a new workflow for an application' })
  @ApiResponse({ status: 201, description: 'Workflow created', type: WorkflowDto })
  async create(@Param('appId') appId: string, @Body() body: CreateWorkflowDto, @CurrentUser() user: any) {
    const prisma = db.getClient();

    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    const workflow = await prisma.workflow.create({
      data: {
        applicationId: appId,
        name: body.name,
        description: body.description,
        nodes: body.nodes ?? [],
        edges: body.edges ?? [],
        config: body.config ?? {},
        triggerType: body.triggerType ?? 'manual',
      },
    });

    logger.info('Workflow created', {
      workflowId: workflow.id,
      applicationId: appId,
      userId: user.id,
    });

    return workflow;
  }

  // ─── List Workflows ─────────────────────────────────────────────

  @Get('applications/:appId/workflows')
  @ApiTags('Workflows')
  @ApiOperation({ summary: 'List workflows for an application' })
  @ApiResponse({ status: 200, type: PaginatedWorkflowsDto })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async list(
    @Param('appId') appId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: any,
  ) {
    const prisma = db.getClient();
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit || '50', 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    const [workflows, total] = await Promise.all([
      prisma.workflow.findMany({
        where: { applicationId: appId, isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          triggerType: true,
          status: true,
          version: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.workflow.count({
        where: { applicationId: appId, isActive: true },
      }),
    ]);

    return { data: workflows, total, page: pageNum, limit: limitNum };
  }

  // ─── Get Workflow Detail ────────────────────────────────────────

  @Get('applications/:appId/workflows/:id')
  @ApiTags('Workflows')
  @ApiOperation({ summary: 'Get workflow with full definition' })
  @ApiResponse({ status: 200, type: WorkflowDto })
  async getById(@Param('appId') appId: string, @Param('id') id: string, @CurrentUser() user: any) {
    const prisma = db.getClient();

    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    const workflow = await prisma.workflow.findFirst({
      where: { id, applicationId: appId, isActive: true },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');

    return workflow;
  }

  // ─── Update Workflow ────────────────────────────────────────────

  @Patch('applications/:appId/workflows/:id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiTags('Workflows')
  @ApiOperation({ summary: 'Update workflow definition' })
  @ApiResponse({ status: 200, type: WorkflowDto })
  async update(
    @Param('appId') appId: string,
    @Param('id') id: string,
    @Body() body: UpdateWorkflowDto,
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();

    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    const existing = await prisma.workflow.findFirst({
      where: { id, applicationId: appId, isActive: true },
    });
    if (!existing) throw new NotFoundException('Workflow not found');

    const updateData: Record<string, any> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.nodes !== undefined) updateData.nodes = body.nodes;
    if (body.edges !== undefined) updateData.edges = body.edges;
    if (body.config !== undefined) updateData.config = body.config;
    if (body.triggerType !== undefined) updateData.triggerType = body.triggerType;
    if (body.status !== undefined) updateData.status = body.status;

    // Auto-increment version when graph changes
    if (body.nodes !== undefined || body.edges !== undefined) {
      updateData.version = existing.version + 1;
    }

    const workflow = await prisma.workflow.update({
      where: { id },
      data: updateData,
    });

    logger.info('Workflow updated', {
      workflowId: id,
      applicationId: appId,
      userId: user.id,
      version: workflow.version,
    });

    return workflow;
  }

  // ─── Delete Workflow (soft) ─────────────────────────────────────

  @Delete('applications/:appId/workflows/:id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiTags('Workflows')
  @ApiOperation({ summary: 'Soft-delete a workflow' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async delete(@Param('appId') appId: string, @Param('id') id: string, @CurrentUser() user: any) {
    const prisma = db.getClient();

    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    const existing = await prisma.workflow.findFirst({
      where: { id, applicationId: appId, isActive: true },
    });
    if (!existing) throw new NotFoundException('Workflow not found');

    await prisma.workflow.update({
      where: { id },
      data: { isActive: false, status: 'DISABLED' },
    });

    logger.info('Workflow deleted', {
      workflowId: id,
      applicationId: appId,
      userId: user.id,
    });

    return { message: 'Workflow deleted' };
  }

  // ─── Templates ──────────────────────────────────────────────────

  @Get('workflow-templates')
  @ApiTags('Workflow Templates')
  @ApiOperation({ summary: 'List available workflow templates' })
  async listTemplates() {
    const prisma = db.getClient();
    return prisma.workflowTemplate.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  @Get('workflow-templates/:id')
  @ApiTags('Workflow Templates')
  @ApiOperation({ summary: 'Get workflow template detail' })
  @ApiResponse({ status: 200, type: WorkflowTemplateDto })
  async getTemplate(@Param('id') id: string) {
    const prisma = db.getClient();
    const template = await prisma.workflowTemplate.findFirst({
      where: { id, isActive: true },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  @Post('applications/:appId/workflows/from-template')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiTags('Workflow Templates')
  @ApiOperation({ summary: 'Create a workflow from a template' })
  @ApiResponse({ status: 201, type: WorkflowDto })
  async createFromTemplate(
    @Param('appId') appId: string,
    @Body() body: CreateFromTemplateDto,
    @CurrentUser() user: any,
  ) {
    const prisma = db.getClient();

    const app = await prisma.application.findFirst({
      where: { id: appId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    const template = await prisma.workflowTemplate.findFirst({
      where: { id: body.templateId, isActive: true },
    });
    if (!template) throw new NotFoundException('Template not found');

    const workflow = await prisma.workflow.create({
      data: {
        applicationId: appId,
        name: body.name,
        description: template.description,
        nodes: template.nodes as any,
        edges: template.edges as any,
        config: template.config as any,
        triggerType: 'manual',
      },
    });

    logger.info('Workflow created from template', {
      workflowId: workflow.id,
      templateId: body.templateId,
      applicationId: appId,
      userId: user.id,
    });

    return workflow;
  }
}
