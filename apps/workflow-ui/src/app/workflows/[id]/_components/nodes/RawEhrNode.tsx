'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

export function RawEhrNode({ data }: NodeProps) {
  const d = data as Record<string, any>;
  const ehrName = d.ehrName || 'any';
  const methodName = d.methodName || 'unknown';

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 min-w-[170px] shadow-md transition-all hover:shadow-lg bg-blue-50 border-blue-300`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={`!bg-blue-500 hover:!ring-blue-300 !w-3 !h-3 !border-2 !border-white`}
      />

      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1 text-blue-600">
        <span className={`text-sm leading-none`}>📂</span>
        <span className={`text-[10px] font-semibold uppercase tracking-wide`}>Raw EHR API</span>
      </div>

      {/* Label */}
      <div className="text-[13px] font-medium text-gray-900 leading-snug">{d.label || `${methodName}`}</div>

      {/* EHR badge */}
      <div className="mt-1.5 flex items-center gap-1">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-600 border border-blue-300`}
        >
          {ehrName.toUpperCase()}
        </span>
      </div>

      {/* Method Name */}
      <div className="text-[10px] text-gray-400 mt-1 truncate max-w-[140px] font-mono">.{methodName}()</div>

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
        className={`!bg-blue-500 hover:!ring-blue-300 !w-3 !h-3 !border-2 !border-white`}
      />
    </div>
  );
}
