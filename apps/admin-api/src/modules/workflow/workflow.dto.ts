import { IsString, IsOptional, IsObject, IsArray, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkflowDto {
  @ApiProperty({ description: 'Workflow name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Workflow description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Initial node definitions', type: 'array' })
  @IsArray()
  @IsOptional()
  nodes?: any[];

  @ApiPropertyOptional({ description: 'Initial edge definitions', type: 'array' })
  @IsArray()
  @IsOptional()
  edges?: any[];

  @ApiPropertyOptional({ description: 'Workflow configuration' })
  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Trigger type', enum: ['manual', 'webhook', 'schedule'] })
  @IsString()
  @IsOptional()
  @IsEnum(['manual', 'webhook', 'schedule'])
  triggerType?: string;
}

export class UpdateWorkflowDto {
  @ApiPropertyOptional({ description: 'Workflow name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Workflow description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Node definitions', type: 'array' })
  @IsArray()
  @IsOptional()
  nodes?: any[];

  @ApiPropertyOptional({ description: 'Edge definitions', type: 'array' })
  @IsArray()
  @IsOptional()
  edges?: any[];

  @ApiPropertyOptional({ description: 'Workflow configuration' })
  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Trigger type', enum: ['manual', 'webhook', 'schedule'] })
  @IsString()
  @IsOptional()
  @IsEnum(['manual', 'webhook', 'schedule'])
  triggerType?: string;

  @ApiPropertyOptional({ description: 'Workflow status', enum: ['DRAFT', 'ACTIVE', 'DISABLED'] })
  @IsString()
  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'DISABLED'])
  status?: string;
}

export class ExecuteWorkflowDto {
  @ApiPropertyOptional({ description: 'Input data for workflow trigger' })
  @IsObject()
  @IsOptional()
  triggerInput?: Record<string, any>;
}

export class CreateFromTemplateDto {
  @ApiProperty({ description: 'Template ID to create workflow from' })
  @IsString()
  @IsNotEmpty()
  templateId!: string;

  @ApiProperty({ description: 'Name for the new workflow' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
