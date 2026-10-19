'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

const OP_LABELS: Record<string, string> = {
  equals: '=',
  not_equals: '\u2260',
  greater_than: '>',
  less_than: '<',
  gte: '\u2265',
  lte: '\u2264',
  contains: '\u2283',
  not_contains: '\u2285',
  is_empty: 'empty',
  is_not_empty: '\u2260 empty',
  exists: 'exists',
  not_exists: '\u2204',
};

export function ConditionNode({ data }: NodeProps) {
  const d = data as Record<string, any>;

  // Build human-readable summary from rules
  let summary: string | null = null;
  if (d.rules?.length) {
    const logic = d.logic || 'and';
    const parts = d.rules.slice(0, 2).map((r: any) => {
      const left = shortenRef(r.left || '?');
      const op = OP_LABELS[r.operator] || r.operator;
      const right = r.right ? shortenRef(r.right) : '';
      return `${left} ${op} ${right}`.trim();
    });
    summary = parts.join(logic === 'and' ? ' & ' : ' | ');
    if (d.rules.length > 2) summary += ` +${d.rules.length - 2}`;
  } else if (d.expression) {
    summary = d.expression;
  }

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 bg-yellow-50 min-w-[160px] shadow-md transition-all hover:shadow-lg ${d.borderColor || 'border-yellow-300'}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-yellow-500 !w-3 !h-3 !border-2 !border-white hover:!ring-2 hover:!ring-yellow-300"
      />

      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-yellow-600 text-sm leading-none">&#9135;</span>
        <span className="text-[10px] font-semibold text-yellow-600 uppercase tracking-wide">Condition</span>
      </div>

      {/* Label */}
      <div className="text-[13px] font-medium text-gray-900 leading-snug">{d.label || 'If / Else'}</div>

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

      {/* True / False handle labels */}
      <div className="relative mt-2 h-4">
        <span
          className="absolute text-[9px] font-semibold text-green-600 uppercase"
          style={{ left: 'calc(30% - 12px)' }}
        >
          True
        </span>
        <span className="absolute text-[9px] font-semibold text-red-500 uppercase" style={{ left: 'calc(70% - 12px)' }}>
          False
        </span>
      </div>

      {/* Two output handles: true (left) and false (right) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="!bg-green-500 !w-3 !h-3 !border-2 !border-white hover:!ring-2 hover:!ring-green-300"
        style={{ left: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!bg-red-500 !w-3 !h-3 !border-2 !border-white hover:!ring-2 hover:!ring-red-300"
        style={{ left: '70%' }}
      />
    </div>
  );
}

/** Shorten a template expression for display in the node */
function shortenRef(s: string): string {
  // {{nodes.search-patient-123456.output}} → search-patient
  const m = s.match(/\{\{nodes\.([^.}]+)/);
  if (m) {
    const id = m[1].replace(/-\d{6,}$/, '');
    return id.length > 15 ? id.slice(0, 15) + '..' : id;
  }
  if (s.length > 18) return s.slice(0, 18) + '..';
  return s;
}
