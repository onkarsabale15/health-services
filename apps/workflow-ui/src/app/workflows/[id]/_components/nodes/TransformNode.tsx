'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

export function TransformNode({ data }: NodeProps) {
  const d = data as Record<string, any>;
  const nodeType = d.nodeType || 'transform';

  const typeLabel = nodeType === 'set-variable' ? 'Set Variable' : nodeType === 'loop' ? 'Loop' : 'Transform';

  const icon = nodeType === 'set-variable' ? '=' : nodeType === 'loop' ? '\u21BB' : '\uFE64\uFE65';

  // Build a human-readable summary based on node type
  let summary: string | null = null;

  if (nodeType === 'transform' && d.mappings?.length) {
    const fieldNames = d.mappings
      .filter((m: any) => m.outputField)
      .map((m: any) => m.outputField)
      .slice(0, 3);
    summary =
      fieldNames.length > 0
        ? `${fieldNames.join(', ')}${d.mappings.length > 3 ? ` +${d.mappings.length - 3}` : ''}`
        : `${d.mappings.length} field(s)`;
  } else if (nodeType === 'set-variable' && d.name) {
    summary = `${d.name} = ${d.valueType === 'static' ? `"${(d.value || '').slice(0, 20)}"` : (d.value || d.expression || '').slice(0, 25)}`;
  } else if (nodeType === 'loop') {
    summary =
      d.loopType === 'count' ? `${d.count || '?'} iterations` : d.source ? `each ${d.itemName || 'item'}` : null;
  }

  // Fallback to raw expression if nothing else
  if (!summary && d.expression) {
    summary = d.expression;
  }

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 bg-slate-50 min-w-[160px] shadow-md transition-all hover:shadow-lg ${d.borderColor || 'border-slate-300'}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-500 !w-3 !h-3 !border-2 !border-white hover:!ring-2 hover:!ring-slate-300"
      />

      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-slate-500 text-sm leading-none font-mono">{icon}</span>
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{typeLabel}</span>
      </div>

      {/* Label */}
      <div className="text-[13px] font-medium text-gray-900 leading-snug">{d.label || typeLabel}</div>

      {/* Summary */}
      {summary && <div className="text-[10px] text-gray-400 mt-1 truncate max-w-[140px]">{summary}</div>}

      {/* Step result */}
      {d.stepResult && (
        <div
          className={`text-[10px] mt-1 font-medium ${d.stepResult.status === 'success' ? 'text-green-600' : 'text-red-600'}`}
        >
          {d.stepResult.durationMs}ms
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-500 !w-3 !h-3 !border-2 !border-white hover:!ring-2 hover:!ring-slate-300"
      />
    </div>
  );
}
