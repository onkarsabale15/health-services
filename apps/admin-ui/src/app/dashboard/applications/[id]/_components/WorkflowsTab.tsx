'use client';

import { useEffect, useState } from 'react';
import {
  workflowControllerList,
  workflowExecutionControllerListExecutions,
  authControllerCreateSsoCode,
} from '@/lib/sdk/generated';
import { Button } from '@/components/button';

const WORKFLOW_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-green-100 text-green-700',
  DISABLED: 'bg-red-100 text-red-700',
};

const EXECUTION_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  RUNNING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-yellow-100 text-yellow-700',
};

interface WorkflowsTabProps {
  app: any;
  appId: string;
  isReadonly: boolean;
  toast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function WorkflowsTab({ app, appId, isReadonly, toast }: WorkflowsTabProps) {
  return (
    <div className="space-y-6">
      <WorkflowsSection appId={appId} isReadonly={isReadonly} toast={toast} />
      <RecentExecutionsSection appId={appId} toast={toast} />
    </div>
  );
}

// --- Workflows Section ---

function WorkflowsSection({
  appId,
  isReadonly,
  toast,
}: {
  appId: string;
  isReadonly: boolean;
  toast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}) {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadWorkflows();
  }, [appId]);

  async function loadWorkflows() {
    try {
      const { data: res, error: wfErr } = await workflowControllerList({ path: { appId } });
      if (wfErr) {
        if ((wfErr as any)?.status === 404) {
          setWorkflows([]);
          return;
        }
        throw new Error((wfErr as any)?.message || 'Failed to load workflows');
      }
      setWorkflows((res as any)?.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }

  async function handleDesignWorkflow() {
    try {
      // Create a short-lived opaque SSO code (never send JWTs in URLs)
      const { data: ssoData } = await authControllerCreateSsoCode();
      if (!ssoData) throw new Error('Failed to create SSO code');
      const workflowUiUrl = process.env.NEXT_PUBLIC_WORKFLOW_UI_URL || 'http://localhost:3005';
      window.open(`${workflowUiUrl}/auth/sso-launch#sso_code=${(ssoData as any).sso_code}&appId=${appId}`, '_blank');
    } catch {
      toast('Session expired. Please sign in again.', 'error');
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Workflows</h2>
        {!isReadonly && (
          <Button variant="primary" size="sm" onClick={handleDesignWorkflow}>
            Design Workflow
          </Button>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">No workflows configured yet.</p>
          {!isReadonly && (
            <p className="text-gray-400 text-xs mt-1">
              Click &quot;Design Workflow&quot; to create one in the workflow builder.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Trigger</th>
                <th className="pb-2 font-medium">Version</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((wf: any) => (
                <tr key={wf.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 font-medium">{wf.name}</td>
                  <td className="py-3 text-gray-600">{wf.trigger || '-'}</td>
                  <td className="py-3 text-gray-600">{wf.version || '1'}</td>
                  <td className="py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${WORKFLOW_STATUS_STYLES[wf.status] || 'bg-gray-100 text-gray-700'}`}
                    >
                      {wf.status}
                    </span>
                  </td>
                  <td className="py-3 text-gray-500 text-xs">
                    {wf.updatedAt ? new Date(wf.updatedAt).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Recent Executions Section ---

function RecentExecutionsSection({
  appId,
  toast,
}: {
  appId: string;
  toast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}) {
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExecutions();
  }, [appId]);

  async function loadExecutions() {
    try {
      const { data } = await workflowExecutionControllerListExecutions({ path: { appId }, query: { limit: 10 } });
      setExecutions((data as any)?.data ?? []);
    } catch {
      // Endpoint may not exist yet — show empty state
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(ms: number | null | undefined): string {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Recent Executions</h2>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded" />
          ))}
        </div>
      ) : executions.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-6">No recent workflow executions.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Workflow</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Duration</th>
                <th className="pb-2 font-medium">Triggered At</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((exec: any) => (
                <tr key={exec.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 font-medium">{exec.workflowName || exec.workflow?.name || '-'}</td>
                  <td className="py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${EXECUTION_STATUS_STYLES[exec.status] || 'bg-gray-100 text-gray-700'}`}
                    >
                      {exec.status}
                    </span>
                  </td>
                  <td className="py-3 text-gray-600">{formatDuration(exec.durationMs)}</td>
                  <td className="py-3 text-gray-500 text-xs">
                    {exec.createdAt ? new Date(exec.createdAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
