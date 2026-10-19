// ─── Node Types ─────────────────────────────────────────────────────────────

export type NodeType =
  | 'trigger'
  | 'raw-ehr'
  | 'transform'
  | 'condition'
  | 'llm-prompt'
  | 'set-variable'
  | 'merge'
  | 'loop'
  | 'output';

// ─── Trigger Types ──────────────────────────────────────────────────────────

export type TriggerType = 'manual' | 'webhook' | 'schedule';

// ─── EHR Connection Binding ─────────────────────────────────────────────────

export type ConnectionMode = 'auto' | 'explicit' | 'per-node';

// ─── Execution Status ───────────────────────────────────────────────────────

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

// ─── Workflow Definition ────────────────────────────────────────────────────

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // for condition nodes: 'true' | 'false'
  label?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: Record<string, any>; // global workflow variables
  connectionMode?: ConnectionMode;
  defaultEhrName?: string;
  connectionId?: string; // for explicit mode
}

// ─── Node Configuration Types ───────────────────────────────────────────────

export interface TriggerConfig {
  triggerType: TriggerType;
  inputSchema?: Record<string, any>; // JSON Schema for manual/webhook inputs
}

export interface RawEhrConfig {
  ehrName: string;
  methodName: string;
  argumentsExpr: string; // JSON array expression evaluated at runtime
  connectionIdExpr?: string; // Optional: dynamically evaluate connectionId
}

export interface TransformConfig {
  expression: string; // JSONata expression
}

export interface ConditionConfig {
  expression: string; // JSONata expression returning boolean
}

export interface LlmPromptConfig {
  provider: string;
  model: string;
  systemPrompt: string;
  userPromptTemplate: string; // may contain {{expressions}}
  temperature?: number;
  maxTokens?: number;
}

export interface SetVariableConfig {
  variableName: string;
  expression: string; // JSONata expression
}

export interface MergeConfig {
  strategy: 'waitAll' | 'firstCompleted';
}

export interface LoopConfig {
  collection: string; // JSONata expression for array
  itemVariable: string; // variable name for current item
}

export interface OutputConfig {
  expression: string; // JSONata expression for final output
}

// ─── Execution Context ──────────────────────────────────────────────────────

export interface StepResult {
  nodeId: string;
  status: StepStatus;
  output?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
}

export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  applicationId: string;
  triggerInput: Record<string, any>;
  variables: Record<string, any>;
  stepResults: Map<string, StepResult>;
  status: ExecutionStatus;
  startedAt: Date;
}

// ─── Node Handler (injected by caller — DIP) ───────────────────────────────

export interface NodeHandlers {
  executeRawEhr(connectionId: string, ehrName: string, methodName: string, args: any[]): Promise<any>;

  llmChat(
    provider: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<{ content: string; usage?: { inputTokens: number; outputTokens: number } }>;
}
