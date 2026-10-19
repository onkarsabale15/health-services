'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { FHIR_RESOURCES, EHR_VENDORS, getFhirResource, type FhirParamDef } from '@hs/bridge-client/fhir';
import type { WorkflowNode } from '@/types';
import { ExpressionInput } from './ExpressionInput';

// ─── Props ──────────────────────────────────────────────────────────────────

interface NodeConfigPanelProps {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  appId: string;
  workflowEhr: string;
  ehrLocked?: boolean;
  onConfigChange: (nodeId: string, config: Record<string, any>) => void;
  onEhrChange: (ehr: string) => void;
  onClose: () => void;
}

// ─── LLM providers ──────────────────────────────────────────────────────────

const LLM_PROVIDERS = [
  { key: 'anthropic', label: 'Anthropic', requiresKey: true },
  { key: 'openai', label: 'OpenAI', requiresKey: true },
  { key: 'gemini', label: 'Google Gemini', requiresKey: true },
  { key: 'ollama', label: 'Ollama', requiresKey: false },
  { key: 'bedrock', label: 'AWS Bedrock', requiresKey: false },
  { key: 'vllm', label: 'vLLM', requiresKey: false },
];

// ─── Main component ─────────────────────────────────────────────────────────

export function NodeConfigPanel({
  node,
  allNodes,
  appId,
  workflowEhr,
  ehrLocked,
  onConfigChange,
  onEhrChange,
  onClose,
}: NodeConfigPanelProps) {
  function updateConfig(key: string, value: any) {
    onConfigChange(node.id, { ...node.config, [key]: value });
  }

  const isRawEhr = node.type === 'raw-ehr';

  return (
    <div className="w-80 bg-white border-l overflow-y-auto shrink-0 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">
          {node.type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
          &times;
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Label */}
        <FieldGroup label="Label">
          <input
            type="text"
            value={node.label || ''}
            onChange={(e) => onConfigChange(node.id, { ...node.config, __label: e.target.value })}
            className="w-full border rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </FieldGroup>

        {/* Raw EHR config */}
        {isRawEhr && (
          <RawEhrNodeConfig
            node={node}
            allNodes={allNodes}
            workflowEhr={workflowEhr}
            ehrLocked={ehrLocked}
            onEhrChange={onEhrChange}
            updateConfig={updateConfig}
          />
        )}

        {/* Trigger config */}
        {node.type === 'trigger-manual' && <TriggerConfig node={node} updateConfig={updateConfig} />}

        {/* LLM config */}
        {node.type === 'llm-prompt' && (
          <LlmNodeConfig node={node} allNodes={allNodes} appId={appId} updateConfig={updateConfig} />
        )}

        {/* Transform config */}
        {node.type === 'transform' && <TransformConfig node={node} nodes={allNodes} updateConfig={updateConfig} />}

        {/* Set Variable config */}
        {node.type === 'set-variable' && <SetVariableConfig node={node} nodes={allNodes} updateConfig={updateConfig} />}

        {/* Condition config */}
        {node.type === 'condition' && <ConditionConfig node={node} nodes={allNodes} updateConfig={updateConfig} />}

        {/* Loop config */}
        {node.type === 'loop' && <LoopConfig node={node} nodes={allNodes} updateConfig={updateConfig} />}

        {/* Output config */}
        {node.type === 'output' && <OutputConfig node={node} nodes={allNodes} updateConfig={updateConfig} />}
      </div>
    </div>
  );
}

// ─── FHIR Node Config ───────────────────────────────────────────────────────

// ─── Raw EHR Node Config ────────────────────────────────────────────────────

function RawEhrNodeConfig({
  node,
  allNodes,
  workflowEhr,
  ehrLocked,
  onEhrChange,
  updateConfig,
}: {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  workflowEhr: string;
  ehrLocked?: boolean;
  onEhrChange: (ehr: string) => void;
  updateConfig: (key: string, value: any) => void;
}) {
  return (
    <div className="space-y-4">
      {/* EHR Vendor */}
      {!ehrLocked && (
        <FieldGroup label="EHR Vendor">
          <select
            value={node.config.ehrName || workflowEhr}
            onChange={(e) => updateConfig('ehrName', e.target.value)}
            className="w-full border rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select EHR...</option>
            {EHR_VENDORS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </FieldGroup>
      )}

      {/* Method Name */}
      <FieldGroup label="Method Name">
        <input
          type="text"
          value={node.config.methodName || ''}
          onChange={(e) => updateConfig('methodName', e.target.value)}
          placeholder="searchPatients, createSoapNote..."
          className="w-full border rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 font-mono"
        />
        <p className="text-[9px] text-gray-400 mt-1">Must match a method in @hs/ehr-data-service</p>
      </FieldGroup>

      {/* Connection ID Expression */}
      <FieldGroup label="Connection ID (optional)">
        <ExpressionInput
          value={node.config.connectionIdExpr || ''}
          onChange={(v) => updateConfig('connectionIdExpr', v)}
          allNodes={allNodes}
          currentNodeId={node.id}
          placeholder="{{trigger.output.connectionId}}"
        />
        <p className="text-[9px] text-gray-400 mt-1">Overrides workflow-level connection</p>
      </FieldGroup>

      {/* Arguments Expression */}
      <FieldGroup label="Arguments (JSON Array)">
        <ExpressionInput
          value={node.config.argumentsExpr || '[]'}
          onChange={(v) => updateConfig('argumentsExpr', v)}
          allNodes={allNodes}
          currentNodeId={node.id}
          placeholder='[{"patient": "{{trigger.patientId}}"}]'
          multiline
          rows={6}
        />
        <p className="text-[9px] text-gray-400 mt-1">Evaluated as an array of arguments for the method</p>
      </FieldGroup>
    </div>
  );
}

// ─── Generic field wrapper ──────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ─── Trigger Config ─────────────────────────────────────────────────────────

function TriggerConfig({ node, updateConfig }: { node: WorkflowNode; updateConfig: (k: string, v: any) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Define the input schema for manual triggers. The user fills these fields when executing.
      </p>
      <FieldGroup label="Input Fields (JSON)">
        <textarea
          value={node.config.inputSchema ? JSON.stringify(node.config.inputSchema, null, 2) : ''}
          onChange={(e) => {
            try {
              updateConfig('inputSchema', JSON.parse(e.target.value));
            } catch {
              /* invalid */
            }
          }}
          rows={4}
          placeholder='{"patientId": {"type": "string", "required": true}}'
          className="w-full border rounded-md px-2.5 py-1.5 text-xs font-mono focus:ring-2 focus:ring-blue-500"
        />
      </FieldGroup>
    </div>
  );
}

// ─── Shared: Node output picker ────────────────────────────────────────────

/** Builds list of available node outputs for "pick from previous node" dropdowns */
function useNodeOutputOptions(currentNodeId: string, allNodes: WorkflowNode[]) {
  return useMemo(() => {
    return allNodes
      .filter((n) => n.id !== currentNodeId)
      .map((n) => ({
        id: n.id,
        label: n.label || n.id,
        type: n.type,
        expression: `{{nodes.${n.id}.output}}`,
      }));
  }, [currentNodeId, allNodes]);
}

function NodeOutputPicker({
  value,
  onChange,
  nodes,
  currentNodeId,
  placeholder,
  allowCustom,
}: {
  value: string;
  onChange: (v: string) => void;
  nodes: WorkflowNode[];
  currentNodeId: string;
  placeholder?: string;
  allowCustom?: boolean;
}) {
  const options = useNodeOutputOptions(currentNodeId, nodes);
  const isCustom = value && !options.some((o) => o.expression === value);
  const [showCustom, setShowCustom] = useState(isCustom);

  return (
    <div className="space-y-1.5">
      {!showCustom ? (
        <select
          value={value || ''}
          onChange={(e) => {
            if (e.target.value === '__custom__') {
              setShowCustom(true);
              return;
            }
            onChange(e.target.value);
          }}
          className="w-full border rounded-md px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{placeholder || 'Select a source...'}</option>
          <option value="{{trigger.output}}">Trigger Input</option>
          {options.map((o) => (
            <option key={o.id} value={o.expression}>
              {o.label} ({o.type.replace(/-/g, ' ')})
            </option>
          ))}
          {allowCustom !== false && <option value="__custom__">Custom expression...</option>}
        </select>
      ) : (
        <div className="space-y-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="{{nodes.step-1.output.field}}"
            className="w-full border rounded-md px-2 py-1.5 text-xs font-mono focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={() => setShowCustom(false)} className="text-[10px] text-blue-600 hover:underline">
            Switch to dropdown
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Transform Config ───────────────────────────────────────────────────────

interface MappingRow {
  outputField: string;
  source: string;
  transform: string;
}

function TransformConfig({
  node,
  nodes,
  updateConfig,
}: {
  node: WorkflowNode;
  nodes: WorkflowNode[];
  updateConfig: (k: string, v: any) => void;
}) {
  const mappings: MappingRow[] = node.config.mappings || [];
  const [showAdvanced, setShowAdvanced] = useState(false);

  function setMappings(next: MappingRow[]) {
    updateConfig('mappings', next);
  }

  function addRow() {
    setMappings([...mappings, { outputField: '', source: '', transform: '' }]);
  }

  function updateRow(idx: number, field: keyof MappingRow, value: string) {
    const next = mappings.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
    setMappings(next);
  }

  function removeRow(idx: number) {
    setMappings(mappings.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Map data from previous steps into output fields. Each row creates one field in this node&apos;s output.
      </p>

      {/* Visual mapping rows */}
      {mappings.map((row, idx) => (
        <div key={idx} className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">Field {idx + 1}</span>
            <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 text-xs">
              Remove
            </button>
          </div>

          <FieldGroup label="Output field name">
            <input
              type="text"
              value={row.outputField}
              onChange={(e) => updateRow(idx, 'outputField', e.target.value)}
              placeholder="patientName"
              className="w-full border rounded-md px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </FieldGroup>

          <FieldGroup label="Source (from previous step)">
            <NodeOutputPicker
              value={row.source}
              onChange={(v) => updateRow(idx, 'source', v)}
              nodes={nodes}
              currentNodeId={node.id}
              placeholder="Pick data source..."
            />
          </FieldGroup>

          <FieldGroup label="Path / Transform (optional)">
            <ExpressionInput
              value={row.transform}
              onChange={(v) => updateRow(idx, 'transform', v)}
              allNodes={nodes}
              currentNodeId={node.id}
              placeholder=".entry[0].resource.name[0].text"
            />
          </FieldGroup>
        </div>
      ))}

      <button
        onClick={addRow}
        className="w-full border-2 border-dashed border-slate-300 rounded-lg py-2 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors"
      >
        + Add field mapping
      </button>

      {/* Advanced: raw expression fallback */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
          Advanced: raw expression {showAdvanced ? '\u25B4' : '\u25BE'}
        </button>
        {showAdvanced && (
          <div className="mt-1">
            <ExpressionInput
              value={node.config.expression || ''}
              onChange={(v) => updateConfig('expression', v)}
              allNodes={nodes}
              currentNodeId={node.id}
              placeholder="JSONata expression (overrides mappings if set)"
              multiline
              rows={4}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Set Variable Config ────────────────────────────────────────────────────

function SetVariableConfig({
  node,
  nodes,
  updateConfig,
}: {
  node: WorkflowNode;
  nodes: WorkflowNode[];
  updateConfig: (k: string, v: any) => void;
}) {
  const valueType = node.config.valueType || 'reference';

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Store a value for use in later steps. Reference it as{' '}
        <code className="text-[10px] bg-gray-100 px-1 rounded">{'{{vars.name}}'}</code>
      </p>

      <FieldGroup label="Variable Name">
        <input
          type="text"
          value={node.config.name || ''}
          onChange={(e) => updateConfig('name', e.target.value)}
          placeholder="patientId"
          className="w-full border rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
        />
      </FieldGroup>

      <FieldGroup label="Value Type">
        <div className="flex gap-1">
          {[
            { key: 'reference', label: 'From a step' },
            { key: 'static', label: 'Static value' },
            { key: 'expression', label: 'Expression' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => updateConfig('valueType', opt.key)}
              className={`flex-1 text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
                valueType === opt.key
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FieldGroup>

      {valueType === 'reference' && (
        <FieldGroup label="Pick from step">
          <NodeOutputPicker
            value={node.config.value || ''}
            onChange={(v) => updateConfig('value', v)}
            nodes={nodes}
            currentNodeId={node.id}
            placeholder="Select step output..."
          />
          <FieldGroup label="Path (optional)">
            <ExpressionInput
              value={node.config.path || ''}
              onChange={(v) => updateConfig('path', v)}
              allNodes={nodes}
              currentNodeId={node.id}
              placeholder=".entry[0].resource.id"
            />
          </FieldGroup>
        </FieldGroup>
      )}

      {valueType === 'static' && (
        <FieldGroup label="Value">
          <input
            type="text"
            value={node.config.value || ''}
            onChange={(e) => updateConfig('value', e.target.value)}
            placeholder="Enter a static value..."
            className="w-full border rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
          />
        </FieldGroup>
      )}

      {valueType === 'expression' && (
        <FieldGroup label="Expression">
          <ExpressionInput
            value={node.config.expression || ''}
            onChange={(v) => updateConfig('expression', v)}
            allNodes={nodes}
            currentNodeId={node.id}
            placeholder="{{nodes.search-1.output.total}} + 1"
            multiline
            rows={3}
          />
        </FieldGroup>
      )}
    </div>
  );
}

// ─── Condition Config ───────────────────────────────────────────────────────

const CONDITION_OPERATORS = [
  { key: 'equals', label: 'equals', symbol: '==' },
  { key: 'not_equals', label: 'does not equal', symbol: '!=' },
  { key: 'greater_than', label: 'is greater than', symbol: '>' },
  { key: 'less_than', label: 'is less than', symbol: '<' },
  { key: 'gte', label: 'is at least', symbol: '>=' },
  { key: 'lte', label: 'is at most', symbol: '<=' },
  { key: 'contains', label: 'contains', symbol: 'contains' },
  { key: 'not_contains', label: 'does not contain', symbol: '!contains' },
  { key: 'is_empty', label: 'is empty', symbol: 'empty' },
  { key: 'is_not_empty', label: 'is not empty', symbol: '!empty' },
  { key: 'exists', label: 'exists', symbol: 'exists' },
  { key: 'not_exists', label: 'does not exist', symbol: '!exists' },
];

const UNARY_OPS = ['is_empty', 'is_not_empty', 'exists', 'not_exists'];

interface ConditionRule {
  left: string;
  operator: string;
  right: string;
}

function ConditionConfig({
  node,
  nodes,
  updateConfig,
}: {
  node: WorkflowNode;
  nodes: WorkflowNode[];
  updateConfig: (k: string, v: any) => void;
}) {
  const rules: ConditionRule[] = node.config.rules || [{ left: '', operator: 'equals', right: '' }];
  const logic = node.config.logic || 'and';
  const [showAdvanced, setShowAdvanced] = useState(false);

  function setRules(next: ConditionRule[]) {
    updateConfig('rules', next);
  }

  function updateRule(idx: number, field: keyof ConditionRule, value: string) {
    const next = rules.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
    setRules(next);
  }

  function addRule() {
    setRules([...rules, { left: '', operator: 'equals', right: '' }]);
  }

  function removeRule(idx: number) {
    if (rules.length <= 1) return;
    setRules(rules.filter((_, i) => i !== idx));
  }

  const isUnary = (op: string) => UNARY_OPS.includes(op);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Route the workflow based on conditions. True branch goes left, False goes right.
      </p>

      {/* Logic operator (AND/OR) */}
      {rules.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-gray-500">Match:</span>
          <div className="flex gap-1">
            {['and', 'or'].map((l) => (
              <button
                key={l}
                onClick={() => updateConfig('logic', l)}
                className={`text-[11px] px-3 py-1 rounded-md border transition-colors ${
                  logic === l
                    ? 'bg-yellow-50 border-yellow-300 text-yellow-700 font-medium'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {l === 'and' ? 'ALL conditions (AND)' : 'ANY condition (OR)'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Condition rules */}
      {rules.map((rule, idx) => (
        <div key={idx} className="border border-yellow-200 rounded-lg p-2.5 bg-yellow-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-yellow-600 uppercase">
              {idx === 0 ? 'If' : logic === 'and' ? 'AND' : 'OR'}
            </span>
            {rules.length > 1 && (
              <button onClick={() => removeRule(idx)} className="text-red-400 hover:text-red-600 text-xs">
                Remove
              </button>
            )}
          </div>

          {/* Left side */}
          <FieldGroup label="Value to check">
            <NodeOutputPicker
              value={rule.left}
              onChange={(v) => updateRule(idx, 'left', v)}
              nodes={nodes}
              currentNodeId={node.id}
              placeholder="Pick value..."
            />
          </FieldGroup>

          {/* Operator */}
          <FieldGroup label="Condition">
            <select
              value={rule.operator}
              onChange={(e) => updateRule(idx, 'operator', e.target.value)}
              className="w-full border rounded-md px-2 py-1.5 text-xs focus:ring-2 focus:ring-yellow-500"
            >
              {CONDITION_OPERATORS.map((op) => (
                <option key={op.key} value={op.key}>
                  {op.label}
                </option>
              ))}
            </select>
          </FieldGroup>

          {/* Right side (hidden for unary operators) */}
          {!isUnary(rule.operator) && (
            <FieldGroup label="Compare with">
              <ExpressionInput
                value={rule.right}
                onChange={(v) => updateRule(idx, 'right', v)}
                allNodes={nodes}
                currentNodeId={node.id}
                placeholder="Value or {{nodes.step.output.field}}"
              />
            </FieldGroup>
          )}

          {/* Human-readable preview */}
          <div className="text-[10px] text-gray-500 bg-white rounded px-2 py-1 border border-gray-100">
            {rule.left || '(value)'}{' '}
            <span className="font-medium text-yellow-700">
              {CONDITION_OPERATORS.find((o) => o.key === rule.operator)?.label || rule.operator}
            </span>
            {!isUnary(rule.operator) && <> {rule.right || '(compare)'}</>}
          </div>
        </div>
      ))}

      <button
        onClick={addRule}
        className="w-full border-2 border-dashed border-yellow-300 rounded-lg py-2 text-xs text-yellow-600 hover:border-yellow-400 hover:text-yellow-700 transition-colors"
      >
        + Add condition
      </button>

      {/* Advanced: raw expression */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
          Advanced: raw expression {showAdvanced ? '\u25B4' : '\u25BE'}
        </button>
        {showAdvanced && (
          <div className="mt-1">
            <ExpressionInput
              value={node.config.expression || ''}
              onChange={(v) => updateConfig('expression', v)}
              allNodes={nodes}
              currentNodeId={node.id}
              placeholder="JSONata expression (overrides visual rules if set)"
              multiline
              rows={3}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Loop Config ────────────────────────────────────────────────────────────

function LoopConfig({
  node,
  nodes,
  updateConfig,
}: {
  node: WorkflowNode;
  nodes: WorkflowNode[];
  updateConfig: (k: string, v: any) => void;
}) {
  const loopType = node.config.loopType || 'forEach';

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Repeat steps for each item in a list, or a fixed number of times.</p>

      <FieldGroup label="Loop Type">
        <div className="flex gap-1">
          {[
            { key: 'forEach', label: 'For each item' },
            { key: 'count', label: 'Fixed count' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => updateConfig('loopType', opt.key)}
              className={`flex-1 text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
                loopType === opt.key
                  ? 'bg-slate-100 border-slate-400 text-slate-700 font-medium'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FieldGroup>

      {loopType === 'forEach' && (
        <>
          <FieldGroup label="Iterate over">
            <NodeOutputPicker
              value={node.config.source || ''}
              onChange={(v) => updateConfig('source', v)}
              nodes={nodes}
              currentNodeId={node.id}
              placeholder="Select a list to loop over..."
            />
          </FieldGroup>

          <FieldGroup label="Array path (optional)">
            <ExpressionInput
              value={node.config.arrayPath || ''}
              onChange={(v) => updateConfig('arrayPath', v)}
              allNodes={nodes}
              currentNodeId={node.id}
              placeholder=".entry  (e.g. for FHIR Bundles)"
            />
          </FieldGroup>

          <FieldGroup label="Item variable name">
            <input
              type="text"
              value={node.config.itemName || 'item'}
              onChange={(e) => updateConfig('itemName', e.target.value)}
              placeholder="item"
              className="w-full border rounded-md px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[9px] text-gray-400 mt-0.5">
              Reference current item as{' '}
              <code className="bg-gray-100 px-0.5 rounded">{'{{loop.' + (node.config.itemName || 'item') + '}}'}</code>
            </p>
          </FieldGroup>
        </>
      )}

      {loopType === 'count' && (
        <>
          <FieldGroup label="Number of iterations">
            <input
              type="number"
              value={node.config.count || ''}
              onChange={(e) => updateConfig('count', parseInt(e.target.value) || '')}
              placeholder="10"
              min={1}
              max={1000}
              className="w-full border rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </FieldGroup>

          <FieldGroup label="Index variable name">
            <input
              type="text"
              value={node.config.indexName || 'index'}
              onChange={(e) => updateConfig('indexName', e.target.value)}
              placeholder="index"
              className="w-full border rounded-md px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[9px] text-gray-400 mt-0.5">
              Reference current index as{' '}
              <code className="bg-gray-100 px-0.5 rounded">
                {'{{loop.' + (node.config.indexName || 'index') + '}}'}
              </code>
            </p>
          </FieldGroup>
        </>
      )}

      <FieldGroup label="Max iterations (safety limit)">
        <input
          type="number"
          value={node.config.maxIterations || 100}
          onChange={(e) => updateConfig('maxIterations', parseInt(e.target.value) || 100)}
          min={1}
          max={10000}
          className="w-full border rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
        />
      </FieldGroup>
    </div>
  );
}

// ─── Output Config ──────────────────────────────────────────────────────────

function OutputConfig({
  node,
  nodes,
  updateConfig,
}: {
  node: WorkflowNode;
  nodes: WorkflowNode[];
  updateConfig: (k: string, v: any) => void;
}) {
  const sourceType = node.config.sourceType || 'reference';

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Select what this workflow returns when finished.</p>

      <FieldGroup label="Output Source">
        <div className="flex gap-1">
          {[
            { key: 'reference', label: 'From a step' },
            { key: 'expression', label: 'Custom expression' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => updateConfig('sourceType', opt.key)}
              className={`flex-1 text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
                sourceType === opt.key
                  ? 'bg-green-50 border-green-300 text-green-700 font-medium'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FieldGroup>

      {sourceType === 'reference' && (
        <FieldGroup label="Pick step output">
          <NodeOutputPicker
            value={node.config.source || ''}
            onChange={(v) => updateConfig('source', v)}
            nodes={nodes}
            currentNodeId={node.id}
            placeholder="Select final output..."
          />
          <FieldGroup label="Path (optional)">
            <ExpressionInput
              value={node.config.path || ''}
              onChange={(v) => updateConfig('path', v)}
              allNodes={nodes}
              currentNodeId={node.id}
              placeholder=".content"
            />
          </FieldGroup>
        </FieldGroup>
      )}

      {sourceType === 'expression' && (
        <FieldGroup label="Expression">
          <ExpressionInput
            value={node.config.expression || ''}
            onChange={(v) => updateConfig('expression', v)}
            allNodes={nodes}
            currentNodeId={node.id}
            placeholder="{{nodes.generate-careplan.output.content}}"
            multiline
            rows={3}
          />
        </FieldGroup>
      )}

      <FieldGroup label="Format">
        <select
          value={node.config.format || 'json'}
          onChange={(e) => updateConfig('format', e.target.value)}
          className="w-full border rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="json">JSON</option>
          <option value="text">Plain Text</option>
          <option value="fhir">FHIR Resource</option>
        </select>
      </FieldGroup>
    </div>
  );
}

// ─── LLM Node Config with inline API key management ─────────────────────────

function LlmNodeConfig({
  node,
  allNodes,
  appId,
  updateConfig,
}: {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  appId: string;
  updateConfig: (key: string, value: any) => void;
}) {
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({});
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);

  const provider = node.config.provider || '';
  const providerInfo = LLM_PROVIDERS.find((p) => p.key === provider);
  const requiresKey = providerInfo?.requiresKey ?? false;
  const isKeyConfigured = keyStatus[provider] === true;

  const loadKeyStatus = useCallback(async () => {
    try {
      const data = await api.get(`/applications/${appId}/llm-keys/status`);
      const statusMap: Record<string, boolean> = {};
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          statusMap[item.provider] = item.configured;
        });
      } else if (data && typeof data === 'object') {
        Object.assign(statusMap, data);
      }
      setKeyStatus(statusMap);
    } catch {
      setKeyStatus({});
    }
  }, [appId]);

  useEffect(() => {
    if (appId) loadKeyStatus();
  }, [appId, loadKeyStatus]);

  useEffect(() => {
    setShowKeyInput(false);
    setApiKeyInput('');
  }, [provider]);

  async function handleSaveKey() {
    if (!apiKeyInput.trim() || !provider) return;
    setSaving(true);
    try {
      await api.put(`/applications/${appId}/llm-keys/${provider}`, { apiKey: apiKeyInput.trim() });
      setKeyStatus((prev) => ({ ...prev, [provider]: true }));
      setShowKeyInput(false);
      setApiKeyInput('');
    } catch {
      // Error handled silently — user sees the input stays open
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <FieldGroup label="Provider">
        <select
          value={provider}
          onChange={(e) => updateConfig('provider', e.target.value)}
          className="w-full border rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select...</option>
          {LLM_PROVIDERS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </FieldGroup>

      {/* API Key section */}
      {provider && requiresKey && (
        <div
          className={`border rounded-lg p-3 ${isKeyConfigured ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-gray-700">API Key</span>
              {isKeyConfigured ? (
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                  Configured
                </span>
              ) : (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                  Required
                </span>
              )}
            </div>
            {!showKeyInput && (
              <button onClick={() => setShowKeyInput(true)} className="text-[11px] text-blue-600 hover:underline">
                {isKeyConfigured ? 'Update' : 'Add Key'}
              </button>
            )}
          </div>
          {showKeyInput && (
            <div className="mt-2 space-y-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={`${providerInfo?.label} API key`}
                className="w-full border rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveKey();
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveKey}
                  disabled={saving || !apiKeyInput.trim()}
                  className="bg-green-600 text-white px-2.5 py-1 rounded text-[11px] hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setShowKeyInput(false);
                    setApiKeyInput('');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-[11px] px-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <FieldGroup label="Model">
        <input
          type="text"
          value={node.config.model || ''}
          onChange={(e) => updateConfig('model', e.target.value)}
          placeholder="claude-sonnet-4-20250514"
          className="w-full border rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
        />
      </FieldGroup>
      <FieldGroup label="System Prompt">
        <textarea
          value={node.config.systemPrompt || ''}
          onChange={(e) => updateConfig('systemPrompt', e.target.value)}
          rows={3}
          placeholder="You are a clinical care plan generator..."
          className="w-full border rounded-md px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
        />
      </FieldGroup>
      <FieldGroup label="User Prompt Template">
        <ExpressionInput
          value={node.config.userPromptTemplate || ''}
          onChange={(v) => updateConfig('userPromptTemplate', v)}
          allNodes={allNodes}
          currentNodeId={node.id}
          placeholder="Generate a care plan for: {{nodes.summary.output}}"
          multiline
          rows={4}
        />
      </FieldGroup>
    </div>
  );
}
