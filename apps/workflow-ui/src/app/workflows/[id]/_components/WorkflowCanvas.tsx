'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { TriggerNode } from './nodes/TriggerNode';
import { RawEhrNode } from './nodes/RawEhrNode';
import { LlmPromptNode } from './nodes/LlmPromptNode';
import { TransformNode } from './nodes/TransformNode';
import { ConditionNode } from './nodes/ConditionNode';
import { OutputNode } from './nodes/OutputNode';
import type { WorkflowNode, WorkflowEdge, WorkflowExecution } from '@/types';

const nodeTypes: NodeTypes = {
  'trigger-manual': TriggerNode,
  'trigger-webhook': TriggerNode,
  'raw-ehr': RawEhrNode,
  'llm-prompt': LlmPromptNode,
  transform: TransformNode,
  condition: ConditionNode,
  'set-variable': TransformNode,
  loop: TransformNode,
  output: OutputNode,
};

const defaultEdgeOptions = {
  type: 'smoothstep',
  style: { stroke: '#94a3b8', strokeWidth: 2 },
};

const connectionLineStyle: React.CSSProperties = {
  stroke: '#3b82f6',
  strokeWidth: 2,
  strokeDasharray: '6 3',
};

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (nodes: WorkflowNode[]) => void;
  onEdgesChange: (edges: WorkflowEdge[]) => void;
  onNodeSelect: (node: WorkflowNode | null) => void;
  execution: WorkflowExecution | null;
}

function nodeColor(type: string | undefined): string {
  if (!type) return '#e2e8f0';
  if (type.startsWith('trigger')) return '#a78bfa';
  if (type === 'raw-ehr') return '#60a5fa';
  if (type === 'llm-prompt') return '#fbbf24';
  if (type === 'condition') return '#facc15';
  if (type === 'output') return '#4ade80';
  return '#94a3b8';
}

function toReactFlowNodes(nodes: WorkflowNode[], execution: WorkflowExecution | null): Node[] {
  return nodes.map((n) => {
    const stepResult = execution?.stepResults?.[n.id];
    let borderColor = 'border-gray-200';
    if (stepResult?.status === 'success') borderColor = 'border-green-500';
    if (stepResult?.status === 'error') borderColor = 'border-red-500';

    return {
      id: n.id,
      type: n.type,
      position: n.position,
      data: { ...n.config, label: n.label, nodeType: n.type, stepResult, borderColor },
    };
  });
}

function toReactFlowEdges(edges: WorkflowEdge[], isRunning: boolean): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    type: 'smoothstep',
    animated: isRunning,
    style: { stroke: '#94a3b8', strokeWidth: 2 },
  }));
}

function WorkflowCanvasInner({
  nodes: wfNodes,
  edges: wfEdges,
  onNodesChange: setWfNodes,
  onEdgesChange: setWfEdges,
  onNodeSelect,
  execution,
}: WorkflowCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const isRunning = execution?.status === 'RUNNING';
  const rfNodes = useMemo(() => toReactFlowNodes(wfNodes, execution), [wfNodes, execution]);
  const rfEdges = useMemo(() => toReactFlowEdges(wfEdges, isRunning ?? false), [wfEdges, isRunning]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  // Keep a ref to wfNodes for use in callbacks without stale closures
  const wfNodesRef = useRef(wfNodes);
  wfNodesRef.current = wfNodes;

  // Sync parent state → ReactFlow internal state
  useEffect(() => {
    setNodes(rfNodes);
  }, [rfNodes, setNodes]);

  useEffect(() => {
    setEdges(rfEdges);
  }, [rfEdges, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            style: { stroke: '#94a3b8', strokeWidth: 2 },
          },
          eds,
        ),
      );
      const newEdge: WorkflowEdge = {
        id: `e-${connection.source}-${connection.target}`,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
      };
      setWfEdges([...(wfNodesRef.current.length ? wfEdges : []), newEdge]);
    },
    [wfEdges, setWfEdges, setEdges],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const wfNode = wfNodesRef.current.find((n) => n.id === node.id);
      onNodeSelect(wfNode || null);
    },
    [onNodeSelect],
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  // Sync node position changes back to parent state
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setWfNodes(wfNodesRef.current.map((n) => (n.id === node.id ? { ...n, position: node.position } : n)));
    },
    [setWfNodes],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/workflow-node-type');
      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const id = `${type}-${Date.now()}`;

      // Parse optional drag metadata (label, config) set by palette
      const labelData = event.dataTransfer.getData('application/workflow-node-label');
      const configData = event.dataTransfer.getData('application/workflow-node-config');
      let config: Record<string, any> = {};
      try {
        if (configData) config = JSON.parse(configData);
      } catch {
        /* ignore */
      }

      const newNode: WorkflowNode = {
        id,
        type: type as WorkflowNode['type'],
        label: labelData || type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        config,
        position,
      };

      setWfNodes([...wfNodesRef.current, newNode]);
    },
    [setWfNodes, screenToFlowPosition],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div className="h-full w-full bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineStyle={connectionLineStyle}
        fitView
        deleteKeyCode="Delete"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#e5e7eb" gap={16} size={1.5} />
        <Controls />
        <MiniMap nodeColor={(node) => nodeColor(node.type)} />
      </ReactFlow>
    </div>
  );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
