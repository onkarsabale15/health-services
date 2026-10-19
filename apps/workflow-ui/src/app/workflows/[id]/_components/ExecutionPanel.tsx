'use client';

import type { WorkflowExecution } from '@/types';

interface ExecutionPanelProps {
  execution: WorkflowExecution;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  PENDING: 'text-yellow-600',
  RUNNING: 'text-blue-600',
  COMPLETED: 'text-green-600',
  FAILED: 'text-red-600',
  CANCELLED: 'text-gray-500',
};

const statusIcons: Record<string, string> = {
  PENDING: '...',
  RUNNING: '>>',
  COMPLETED: 'OK',
  FAILED: 'X',
  CANCELLED: '--',
};

export function ExecutionPanel({ execution, onClose }: ExecutionPanelProps) {
  const stepCount = execution.stepResults ? Object.keys(execution.stepResults).length : 0;
  const completedSteps = execution.stepResults
    ? Object.values(execution.stepResults).filter((s) => s.status === 'success').length
    : 0;

  return (
    <div className="bg-white border-t px-4 py-3 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className={`text-sm font-semibold ${statusColors[execution.status]}`}>
            {statusIcons[execution.status]} {execution.status}
          </span>

          {stepCount > 0 && (
            <span className="text-sm text-gray-500">
              Steps: {completedSteps}/{stepCount}
            </span>
          )}

          {execution.durationMs != null && (
            <span className="text-sm text-gray-500">Duration: {(execution.durationMs / 1000).toFixed(1)}s</span>
          )}

          {execution.error && (
            <span className="text-sm text-red-600 truncate max-w-md" title={execution.error}>
              {execution.error}
            </span>
          )}
        </div>

        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
          Close
        </button>
      </div>

      {/* Step results preview */}
      {execution.stepResults && Object.keys(execution.stepResults).length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {Object.entries(execution.stepResults).map(([nodeId, step]) => (
            <div
              key={nodeId}
              className={`text-xs px-2 py-1 rounded border ${
                step.status === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : step.status === 'error'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
              title={step.error || `${step.durationMs}ms`}
            >
              {nodeId} ({step.durationMs}ms)
            </div>
          ))}
        </div>
      )}

      {/* Output preview */}
      {execution.status === 'COMPLETED' && execution.output && (
        <div className="mt-2">
          <details>
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">View Output</summary>
            <pre className="mt-1 text-xs bg-gray-50 rounded p-2 overflow-auto max-h-48 font-mono">
              {typeof execution.output === 'string' ? execution.output : JSON.stringify(execution.output, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
