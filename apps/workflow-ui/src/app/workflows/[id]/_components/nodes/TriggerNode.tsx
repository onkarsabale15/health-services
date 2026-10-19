'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

export function TriggerNode({ data }: NodeProps) {
  const d = data as Record<string, any>;
  const isWebhook = d.nodeType === 'trigger-webhook';

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 bg-purple-50 min-w-[160px] shadow-md transition-all hover:shadow-lg ${d.borderColor || 'border-purple-300'}`}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-purple-500 text-sm leading-none">&#9654;</span>
        <span className="text-[10px] font-semibold text-purple-500 uppercase tracking-wide">
          {isWebhook ? 'Webhook Trigger' : 'Trigger'}
        </span>
      </div>

      {/* Label */}
      <div className="text-[13px] font-medium text-gray-900 leading-snug">
        {d.label || (isWebhook ? 'Webhook Trigger' : 'Manual Trigger')}
      </div>

      {/* Metadata */}
      {isWebhook && d.path && <div className="text-[10px] text-gray-400 mt-1 truncate max-w-[130px]">{d.path}</div>}

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
        className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white hover:!ring-2 hover:!ring-purple-300"
      />
    </div>
  );
}
