import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Common ──────────────────────────────────────────────────

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation successful' })
  message!: string;
}

export class PaginatedResponseDto {
  @ApiProperty({ description: 'Total count of records' })
  total!: number;

  @ApiProperty({ description: 'Current page number' })
  page!: number;

  @ApiProperty({ description: 'Page size' })
  limit!: number;
}

// ─── Auth ────────────────────────────────────────────────────

export class SignInResponseDto {
  @ApiProperty() userId!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() organizationName!: string;
  @ApiProperty({ enum: ['OWNER', 'ADMIN', 'MEMBER'] }) role!: string;
  @ApiProperty() accessToken!: string;
  @ApiProperty() expiresIn!: number;
  @ApiProperty() refreshToken!: string;
}

export class SignUpResponseDto {
  @ApiProperty() userId!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty({ enum: ['PENDING', 'ACTIVE'] }) status!: string;
  @ApiPropertyOptional() message?: string;
  @ApiPropertyOptional() accessToken?: string;
  @ApiPropertyOptional() expiresIn?: number;
  @ApiPropertyOptional() refreshToken?: string;
}

export class RefreshResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() expiresIn!: number;
  @ApiProperty() refreshToken!: string;
}

export class SsoCodeResponseDto {
  @ApiProperty({ description: 'Opaque SSO code (30s TTL, one-time use)' })
  sso_code!: string;
}

// ─── Application ─────────────────────────────────────────────

export class AppEhrAccessDto {
  @ApiProperty() id!: string;
  @ApiProperty() applicationId!: string;
  @ApiProperty() ehrName!: string;
  @ApiProperty({ type: [String] }) ehrTokenScopes!: string[];
  @ApiProperty() ehrConfig!: Record<string, unknown>;
  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] }) status!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

class JwksKeyDto {
  @ApiPropertyOptional() kty?: string;
  @ApiPropertyOptional() alg?: string;
  @ApiPropertyOptional() kid?: string;
  @ApiPropertyOptional() use?: string;
}

class JwksDto {
  @ApiPropertyOptional() uri?: string;
  @ApiPropertyOptional({ type: [JwksKeyDto] }) keys?: JwksKeyDto[];
}

export class ApplicationDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() clientId!: string;
  @ApiProperty({ type: [String] }) redirectUris!: string[];
  @ApiProperty({ type: [String] }) allowedGrantTypes!: string[];
  @ApiProperty({ type: [String] }) scopes!: string[];
  @ApiProperty() tokenLifetime!: number;
  @ApiPropertyOptional({ type: JwksDto }) jwks?: JwksDto;
  @ApiProperty({ enum: ['BRIDGE', 'CDS', 'WORKFLOW', 'CUSTOM'] }) appType!: string;
  @ApiProperty({ enum: ['PUBLIC', 'CONFIDENTIAL'] }) clientType!: string;
  @ApiPropertyOptional() smartLaunchUrl?: string;
  @ApiPropertyOptional() cdsConfig?: Record<string, unknown>;
  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] }) status!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional({ type: [AppEhrAccessDto] }) ehrAccess?: AppEhrAccessDto[];
  @ApiPropertyOptional({ enum: ['FULL', 'READONLY'] }) userAccessLevel?: string;
}

export class PaginatedApplicationsDto extends PaginatedResponseDto {
  @ApiProperty({ type: [ApplicationDto] }) data!: ApplicationDto[];
}

export class CreateApplicationResponseDto extends ApplicationDto {
  @ApiPropertyOptional({ description: 'Client secret (shown only once)' }) clientSecret?: string;
}

export class RotateSecretResponseDto {
  @ApiProperty({ description: 'New client secret (shown only once)' }) clientSecret!: string;
}

export class JwksUpdateResponseDto {
  @ApiProperty() message!: string;
  @ApiProperty() uri!: string;
  @ApiProperty() keyCount!: number;
  @ApiPropertyOptional({ type: [Object] }) keys?: { index: number; kty: string; alg?: string; kid?: string }[];
}

// ─── User ────────────────────────────────────────────────────

export class UserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: ['OWNER', 'ADMIN', 'MEMBER'] }) role!: string;
  @ApiProperty({ enum: ['PENDING', 'ACTIVE', 'DISABLED'] }) status!: string;
  @ApiProperty() createdAt!: Date;
}

export class PaginatedUsersDto extends PaginatedResponseDto {
  @ApiProperty({ type: [UserDto] }) data!: UserDto[];
}

export class UserAppAccessDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() applicationId!: string;
  @ApiProperty({ enum: ['READONLY', 'FULL'] }) accessLevel!: string;
  @ApiProperty() createdAt!: Date;
}

// ─── Organization ────────────────────────────────────────────

export class OrganizationDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() domain?: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional() _count?: { users: number; applications: number };
}

// ─── Workflow ────────────────────────────────────────────────

export class WorkflowDto {
  @ApiProperty() id!: string;
  @ApiProperty() applicationId!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() nodes!: unknown[];
  @ApiProperty() edges!: unknown[];
  @ApiProperty() config!: Record<string, unknown>;
  @ApiProperty() triggerType!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ enum: ['DRAFT', 'ACTIVE', 'DISABLED'] }) status!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class WorkflowSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() triggerType!: string;
  @ApiProperty({ enum: ['DRAFT', 'ACTIVE', 'DISABLED'] }) status!: string;
  @ApiProperty() version!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class PaginatedWorkflowsDto extends PaginatedResponseDto {
  @ApiProperty({ type: [WorkflowSummaryDto] }) data!: WorkflowSummaryDto[];
}

export class WorkflowTemplateDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() category!: string;
  @ApiProperty() nodes!: unknown[];
  @ApiProperty() edges!: unknown[];
  @ApiProperty() config!: Record<string, unknown>;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

// ─── Execution ───────────────────────────────────────────────

export class ExecuteResponseDto {
  @ApiProperty() executionId!: string;
  @ApiProperty({ example: 'PENDING' }) status!: string;
}

export class ExecutionSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() workflowId!: string;
  @ApiProperty() workflowName!: string;
  @ApiProperty({ enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] }) status!: string;
  @ApiPropertyOptional() startedAt?: Date;
  @ApiPropertyOptional() completedAt?: Date;
  @ApiPropertyOptional() durationMs?: number;
  @ApiProperty() createdAt!: Date;
}

export class PaginatedExecutionsDto extends PaginatedResponseDto {
  @ApiProperty({ type: [ExecutionSummaryDto] }) data!: ExecutionSummaryDto[];
}

export class ExecutionDetailDto extends ExecutionSummaryDto {
  @ApiPropertyOptional() triggerInput?: Record<string, unknown>;
  @ApiPropertyOptional() stepResults?: unknown[];
  @ApiPropertyOptional() output?: Record<string, unknown>;
  @ApiPropertyOptional() error?: string;
}

export class ExecutionStepsDto {
  @ApiProperty({ enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] }) status!: string;
  @ApiProperty() steps!: unknown[];
}

export class CancelExecutionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'CANCELLED' }) status!: string;
}
