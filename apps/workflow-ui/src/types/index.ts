export type NodeType =
  | 'trigger-manual'
  | 'trigger-webhook'
  | 'raw-ehr'
  | 'llm-prompt'
  | 'transform'
  | 'condition'
  | 'loop'
  | 'set-variable'
  | 'output';

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
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  applicationId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  config?: Record<string, any>;
  triggerType: 'MANUAL' | 'WEBHOOK' | 'SCHEDULE';
  status: 'DRAFT' | 'ACTIVE' | 'DISABLED';
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  input?: Record<string, any>;
  output?: any;
  error?: string;
  stepResults?: Record<string, StepResult>;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  createdAt: string;
}

export interface StepResult {
  nodeId: string;
  status: 'success' | 'error' | 'skipped';
  output: any;
  durationMs: number;
  error?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isActive: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  orgId: string;
  role: string;
}
