'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

export function OutputNode({ data }: NodeProps) {
  const d = data as Record<string, any>;

  // Summary of what output returns
  let summary: string | null = null;
  if (d.source) {
    const m = d.source.match(/\{\{nodes\.([^.}]+)/);
    summary = m ? `from: ${m[1].replace(/-\d{6,}$/, '')}` : d.source;
    if (d.path) summary += d.path;
  } else if (d.expression) {
    summary = d.expression;
  }

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 bg-green-50 min-w-[160px] shadow-md transition-all hover:shadow-lg ${d.borderColor || 'border-green-300'}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-green-500 !w-3 !h-3 !border-2 !border-white hover:!ring-2 hover:!ring-green-300"
      />

      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-green-600 text-sm leading-none">&#10003;</span>
        <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wide">Output</span>
      </div>

      {/* Label */}
      <div className="text-[13px] font-medium text-gray-900 leading-snug">{d.label || 'Result'}</div>

      {/* Summary */}
      {summary && <div className="text-[10px] text-gray-400 mt-1 truncate max-w-[140px]">{summary}</div>}

      {/* Format badge */}
      {d.format && (
        <span className="inline-block text-[9px] mt-1.5 px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium uppercase">
          {d.format}
        </span>
      )}

      {/* Step result */}
      {d.stepResult && (
        <div
          className={`text-[10px] mt-1 font-medium ${d.stepResult.status === 'success' ? 'text-green-600' : 'text-red-600'}`}
        >
          {d.stepResult.durationMs}ms
        </div>
      )}
    </div>
  );
}
