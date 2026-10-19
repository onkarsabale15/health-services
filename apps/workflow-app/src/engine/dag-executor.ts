import type {
  WorkflowDefinition,
  WorkflowNode,
  ExecutionContext,
  ExecutionStatus,
  NodeHandlers,
  StepResult,
  RawEhrConfig,
  TransformConfig,
  ConditionConfig,
  LlmPromptConfig,
  SetVariableConfig,
  OutputConfig,
} from './workflow-engine.types';
import { evaluateExpression, resolveTemplate, resolveParams } from './expression-evaluator';

/**
 * DAG Executor — walks the workflow graph topologically and executes each node.
 *
 * Design:
 * - Zero infrastructure deps (DIP — handlers injected by caller)
 * - Topological sort ensures dependencies execute first
 * - Step results are stored in context for downstream expression resolution
 * - Condition nodes produce 'true'/'false' outputs that control branching
 */
export class DagExecutor {
  private definition: WorkflowDefinition;
  private handlers: NodeHandlers;
  private context: ExecutionContext;
  private adjacency: Map<string, string[]> = new Map();
  private nodeMap: Map<string, WorkflowNode> = new Map();

  constructor(definition: WorkflowDefinition, handlers: NodeHandlers, context: ExecutionContext) {
    this.definition = definition;
    this.handlers = handlers;
    this.context = context;
    this.buildGraph();
  }

  /**
   * Execute the entire workflow DAG.
   * Returns the final output (from 'output' node) or the last step result.
   */
  async execute(): Promise<any> {
    this.context.status = 'running';
    const executionOrder = this.topologicalSort();

    let finalOutput: any = null;

    for (const nodeId of executionOrder) {
      if ((this.context.status as ExecutionStatus) === 'cancelled') break;

      const node = this.nodeMap.get(nodeId)!;

      // Check if this node should be skipped (condition branching)
      if (this.isSkipped(nodeId)) {
        this.context.stepResults.set(nodeId, {
          nodeId,
          status: 'skipped',
        });
        continue;
      }

      const stepResult = await this.executeNode(node);
      this.context.stepResults.set(nodeId, stepResult);

      if (stepResult.status === 'failed') {
        this.context.status = 'failed';
        return { error: stepResult.error, nodeId };
      }

      if (node.type === 'output') {
        finalOutput = stepResult.output;
      }
    }

    if (this.context.status === 'running') {
      this.context.status = 'completed';
    }

    return finalOutput;
  }

  private async executeNode(node: WorkflowNode): Promise<StepResult> {
    const startedAt = new Date();
    const start = Date.now();

    try {
      const output = await this.runNodeLogic(node);
      return {
        nodeId: node.id,
        status: 'completed',
        output,
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - start,
      };
    } catch (error: any) {
      return {
        nodeId: node.id,
        status: 'failed',
        error: error.message || String(error),
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - start,
      };
    }
  }

  private async runNodeLogic(node: WorkflowNode): Promise<any> {
    const ctx = this.buildExpressionContext();

    switch (node.type) {
      case 'trigger':
        return this.context.triggerInput;

      case 'raw-ehr': {
        const config = node.config as RawEhrConfig;
        const args = (await evaluateExpression(config.argumentsExpr, ctx)) || [];

        // Connection binding: evaluate connectionIdExpr if present, else fallback to workflow level
        const connectionId = config.connectionIdExpr
          ? await evaluateExpression(config.connectionIdExpr, ctx)
          : this.definition.connectionId;

        if (!connectionId) {
          throw new Error(`connectionId is required for raw-ehr node: ${node.label}`);
        }

        return this.handlers.executeRawEhr(connectionId, config.ehrName, config.methodName, args);
      }

      case 'transform': {
        const config = node.config as TransformConfig;
        return evaluateExpression(config.expression, ctx);
      }

      case 'condition': {
        const config = node.config as ConditionConfig;
        const result = await evaluateExpression(config.expression, ctx);
        return Boolean(result);
      }

      case 'llm-prompt': {
        const config = node.config as LlmPromptConfig;
        const userPrompt = await resolveTemplate(config.userPromptTemplate, ctx);
        const result = await this.handlers.llmChat(config.provider, config.model, config.systemPrompt, userPrompt, {
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        });
        return result;
      }

      case 'set-variable': {
        const config = node.config as SetVariableConfig;
        const value = await evaluateExpression(config.expression, ctx);
        this.context.variables[config.variableName] = value;
        return value;
      }

      case 'merge': {
        // Merge collects outputs from all incoming edges
        const incoming = this.getIncomingNodes(node.id);
        const merged: Record<string, any> = {};
        for (const srcId of incoming) {
          const result = this.context.stepResults.get(srcId);
          if (result?.output !== undefined) {
            merged[srcId] = result.output;
          }
        }
        return merged;
      }

      case 'output': {
        const config = node.config as OutputConfig;
        if (config.expression) {
          return evaluateExpression(config.expression, ctx);
        }
        // Default: return the output of the first incoming node
        const incoming = this.getIncomingNodes(node.id);
        if (incoming.length > 0) {
          return this.context.stepResults.get(incoming[0])?.output;
        }
        return null;
      }

      case 'loop': {
        // Loop is an advanced feature — Phase 2
        throw new Error('Loop node is not yet implemented');
      }

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  /**
   * Build the expression context available to JSONata.
   * Structure: { $trigger, $nodes, $vars, $input }
   */
  private buildExpressionContext(): Record<string, any> {
    const nodes: Record<string, any> = {};
    for (const [nodeId, result] of this.context.stepResults) {
      const node = this.nodeMap.get(nodeId);
      nodes[nodeId] = {
        output: result.output,
        status: result.status,
        label: node?.label,
      };
    }

    return {
      $trigger: this.context.triggerInput,
      $nodes: nodes,
      $vars: this.context.variables,
      $input: this.context.triggerInput,
    };
  }

  /**
   * Check if a node should be skipped due to condition branching.
   * A node is skipped if ALL its incoming edges come from condition nodes
   * and the edge handle doesn't match the condition result.
   */
  private isSkipped(nodeId: string): boolean {
    const incomingEdges = this.definition.edges.filter((e) => e.target === nodeId);

    for (const edge of incomingEdges) {
      const sourceNode = this.nodeMap.get(edge.source);
      if (!sourceNode || sourceNode.type !== 'condition') continue;

      // Condition nodes output true/false. Edge sourceHandle indicates which branch.
      const conditionResult = this.context.stepResults.get(edge.source);
      if (!conditionResult || conditionResult.status !== 'completed') continue;

      const condValue = Boolean(conditionResult.output);
      const handleValue = edge.sourceHandle === 'true';

      if (condValue !== handleValue) {
        return true; // This branch is not taken
      }
    }

    return false;
  }

  private getIncomingNodes(nodeId: string): string[] {
    return this.definition.edges.filter((e) => e.target === nodeId).map((e) => e.source);
  }

  private buildGraph(): void {
    for (const node of this.definition.nodes) {
      this.nodeMap.set(node.id, node);
      this.adjacency.set(node.id, []);
    }

    for (const edge of this.definition.edges) {
      const targets = this.adjacency.get(edge.source);
      if (targets) {
        targets.push(edge.target);
      }
    }
  }

  /**
   * Topological sort using Kahn's algorithm.
   * Guarantees all dependencies execute before dependents.
   */
  private topologicalSort(): string[] {
    const inDegree = new Map<string, number>();

    for (const node of this.definition.nodes) {
      inDegree.set(node.id, 0);
    }

    for (const edge of this.definition.edges) {
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }

    // Start with nodes that have no incoming edges (typically 'trigger')
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) queue.push(nodeId);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      const targets = this.adjacency.get(current) ?? [];
      for (const target of targets) {
        const newDegree = (inDegree.get(target) ?? 1) - 1;
        inDegree.set(target, newDegree);
        if (newDegree === 0) {
          queue.push(target);
        }
      }
    }

    if (sorted.length !== this.definition.nodes.length) {
      throw new Error('Workflow contains a cycle — DAG execution requires an acyclic graph');
    }

    return sorted;
  }
}
