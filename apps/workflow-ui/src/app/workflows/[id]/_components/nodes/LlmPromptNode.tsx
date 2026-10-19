'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

const KEY_REQUIRED_PROVIDERS = ['anthropic', 'openai', 'gemini'];

export function LlmPromptNode({ data }: NodeProps) {
  const d = data as Record<string, any>;
  const requiresKey = KEY_REQUIRED_PROVIDERS.includes(d.provider);
  const hasKey = d.keyConfigured === true;
  const missingKey = requiresKey && !hasKey;

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 bg-amber-50 min-w-[160px] shadow-md transition-all hover:shadow-lg ${d.borderColor || (missingKey ? 'border-amber-500' : 'border-amber-300')}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-amber-500 !w-3 !h-3 !border-2 !border-white hover:!ring-2 hover:!ring-amber-300"
      />

      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-amber-500 text-sm leading-none">&#10022;</span>
        <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">LLM Prompt</span>
        {missingKey && (
          <span className="ml-auto text-amber-500 text-sm leading-none" title="API key required">
            &#9888;
          </span>
        )}
      </div>

      {/* Label */}
      <div className="text-[13px] font-medium text-gray-900 leading-snug">{d.label || 'AI Prompt'}</div>

      {/* Metadata */}
      {d.provider && (
        <div className="text-[10px] text-gray-400 mt-1">
          {d.provider}
          {d.model ? ` / ${d.model}` : ''}
        </div>
      )}

      {/* API key warning */}
      {missingKey && (
        <div className="text-[10px] text-amber-600 font-medium mt-1.5 flex items-center gap-1">
          <span>API key required</span>
        </div>
      )}

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
        className="!bg-amber-500 !w-3 !h-3 !border-2 !border-white hover:!ring-2 hover:!ring-amber-300"
      />
    </div>
  );
}
