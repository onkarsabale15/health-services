'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { WorkflowCanvas } from './_components/WorkflowCanvas';
import { NodePalette } from './_components/NodePalette';
import { NodeConfigPanel } from './_components/NodeConfigPanel';
import { ExecutionPanel } from './_components/ExecutionPanel';
import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution } from '@/types';

const KEY_REQUIRED_PROVIDERS = ['anthropic', 'openai', 'gemini'];

export default function WorkflowEditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workflowId = params.id as string;
  const appId = searchParams.get('appId');
  const { toast } = useToast();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({});
  const [workflowEhr, setWorkflowEhr] = useState('');
  const [ehrLocked, setEhrLocked] = useState(false);

  useEffect(() => {
    loadData();
  }, [workflowId, appId]);

  async function loadData() {
    if (!appId) return;
    setLoading(true);
    try {
      // Fetch workflow + app detail + LLM key status in parallel
      const [wf, detail, keyData] = await Promise.all([
        api.get<Workflow>(`/applications/${appId}/workflows/${workflowId}`),
        api.get<any>(`/applications/${appId}/detail`).catch(() => null),
        api.get<any>(`/applications/${appId}/llm-keys/status`).catch(() => null),
      ]);

      setWorkflow(wf);
      setEdges(wf.edges || []);

      // Determine EHR — locked from app config for WORKFLOW apps, else from workflow config
      const ehrAccess: any[] = detail?.ehrAccess || [];
      const isWorkflowApp = detail?.app?.appType === 'WORKFLOW';
      let ehr = wf.config?.ehrName || '';

      if (isWorkflowApp && ehrAccess.length > 0) {
        ehr = ehrAccess[0].ehrName;
        setEhrLocked(true);
      }
      setWorkflowEhr(ehr);

      // Set nodes with EHR pre-applied to FHIR nodes
      const loadedNodes = wf.nodes || [];
      setNodes(
        ehr
          ? loadedNodes.map((n) => (n.type.startsWith('fhir-') ? { ...n, config: { ...n.config, ehrName: ehr } } : n))
          : loadedNodes,
      );

      // LLM key status
      const statusMap: Record<string, boolean> = {};
      if (Array.isArray(keyData)) {
        keyData.forEach((item: any) => {
          statusMap[item.provider] = item.configured;
        });
      } else if (keyData && typeof keyData === 'object') {
        Object.assign(statusMap, keyData);
      }
      setKeyStatus(statusMap);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // EHR change propagates to all FHIR nodes
  const handleEhrChange = useCallback((ehr: string) => {
    setWorkflowEhr(ehr);
    // Update all FHIR nodes with the new EHR
    setNodes((prev) =>
      prev.map((n) => (n.type.startsWith('fhir-') ? { ...n, config: { ...n.config, ehrName: ehr || undefined } } : n)),
    );
  }, []);

  /** Check all LLM nodes have their provider's API key configured */
  function validateLlmKeys(currentNodes: WorkflowNode[]): string[] {
    const errors: string[] = [];
    const llmNodes = currentNodes.filter((n) => n.type === 'llm-prompt');

    for (const n of llmNodes) {
      const provider = n.config.provider;
      if (!provider) {
        errors.push(`"${n.label || n.id}": no provider selected`);
        continue;
      }
      if (KEY_REQUIRED_PROVIDERS.includes(provider) && !keyStatus[provider]) {
        errors.push(`"${n.label || n.id}": ${provider} API key not configured`);
      }
    }
    return errors;
  }

  /** Validate FHIR nodes have EHR + resource type set */
  function validateFhirNodes(currentNodes: WorkflowNode[]): string[] {
    const errors: string[] = [];
    const fhirNodes = currentNodes.filter((n) => n.type.startsWith('fhir-'));
    const hasTrigger = currentNodes.some((n) => n.type.startsWith('trigger-'));

    for (const n of fhirNodes) {
      if (!n.config.resourceType) {
        errors.push(`"${n.label || n.id}": no resource type selected`);
      }
    }

    // EHR must be set at workflow level or provided by trigger
    if (fhirNodes.length > 0 && !workflowEhr && !hasTrigger) {
      errors.push('EHR vendor must be selected or provided by a trigger node');
    }

    return errors;
  }

  const handleSave = useCallback(async () => {
    if (!appId || !workflow) return;

    const llmErrors = validateLlmKeys(nodes);
    const fhirErrors = validateFhirNodes(nodes);
    const allErrors = [...llmErrors, ...fhirErrors];

    if (allErrors.length > 0) {
      toast(`Validation errors:\n${allErrors.join('\n')}`, 'error');
      return;
    }

    try {
      setSaving(true);
      const updated = await api.patch<Workflow>(`/applications/${appId}/workflows/${workflowId}`, {
        nodes,
        edges,
        config: { ...workflow.config, ehrName: workflowEhr || undefined },
      });
      setWorkflow(updated);
      toast('Workflow saved', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }, [appId, workflowId, nodes, edges, workflow, keyStatus, workflowEhr, toast]);

  const handleExecute = useCallback(
    async (input: Record<string, any>) => {
      if (!appId) return;

      const llmErrors = validateLlmKeys(nodes);
      const fhirErrors = validateFhirNodes(nodes);
      const allErrors = [...llmErrors, ...fhirErrors];

      if (allErrors.length > 0) {
        toast(`Cannot execute:\n${allErrors.join('\n')}`, 'error');
        return;
      }

      try {
        const result = await api.post<{ executionId: string }>(
          `/applications/${appId}/workflows/${workflowId}/execute`,
          { input },
        );
        toast('Execution started', 'info');
        pollExecution(result.executionId);
      } catch (err: any) {
        toast(err.message, 'error');
      }
    },
    [appId, workflowId, nodes, keyStatus, workflowEhr, toast],
  );

  async function pollExecution(executionId: string) {
    const poll = async () => {
      try {
        const exec = await api.get<WorkflowExecution>(`/applications/${appId}/executions/${executionId}`);
        setExecution(exec);
        if (exec.status === 'PENDING' || exec.status === 'RUNNING') {
          setTimeout(poll, 1500);
        }
      } catch {
        // Polling failed — stop
      }
    };
    poll();
  }

  const handleNodeSelect = useCallback((node: WorkflowNode | null) => {
    setSelectedNode(node);
  }, []);

  const handleNodeConfigChange = useCallback(
    (nodeId: string, config: Record<string, any>) => {
      // Handle label rename via __label
      const label = config.__label;
      delete config.__label;

      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          return { ...n, config, ...(label !== undefined ? { label } : {}) };
        }),
      );
      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) => (prev ? { ...prev, config, ...(label !== undefined ? { label } : {}) } : null));
      }
    },
    [selectedNode],
  );

  // Enrich LLM nodes with keyConfigured status for canvas display
  const enrichedNodes = nodes.map((n) => {
    if (n.type === 'llm-prompt' && n.config.provider) {
      return { ...n, config: { ...n.config, keyConfigured: keyStatus[n.config.provider] ?? false } };
    }
    return n;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <p className="text-gray-500">Workflow not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <a href={`/workflows?appId=${appId}`} className="text-gray-500 hover:text-gray-700 text-sm">
            &larr; Back
          </a>
          <span className="font-semibold text-gray-900">{workflow.name}</span>
          <span className="text-xs text-gray-400">v{workflow.version}</span>
          {workflowEhr && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
              EHR: {workflowEhr}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-white border text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-50 text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => handleExecute({})}
            className="bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 text-sm font-medium"
          >
            Execute
          </button>
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — Node Palette */}
        <NodePalette workflowEhr={workflowEhr} onEhrChange={handleEhrChange} ehrLocked={ehrLocked} />

        {/* Center — React Flow Canvas */}
        <div className="flex-1">
          <WorkflowCanvas
            nodes={enrichedNodes}
            edges={edges}
            onNodesChange={setNodes}
            onEdgesChange={setEdges}
            onNodeSelect={handleNodeSelect}
            execution={execution}
          />
        </div>

        {/* Right sidebar — Node Config */}
        {selectedNode && appId && (
          <NodeConfigPanel
            node={selectedNode}
            allNodes={nodes}
            appId={appId}
            workflowEhr={workflowEhr}
            ehrLocked={ehrLocked}
            onConfigChange={handleNodeConfigChange}
            onEhrChange={handleEhrChange}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      {/* Bottom — Execution Panel */}
      {execution && <ExecutionPanel execution={execution} onClose={() => setExecution(null)} />}
    </div>
  );
}
