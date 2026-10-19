'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import type { Workflow } from '@/types';

export default function WorkflowListPage() {
  const searchParams = useSearchParams();
  const appId = searchParams.get('appId');
  const { toast } = useToast();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appId) {
      setLoading(false);
      setError('No application selected. Please launch from the admin dashboard.');
      return;
    }
    loadWorkflows();
  }, [appId]);

  async function loadWorkflows() {
    try {
      setLoading(true);
      const res = await api.get<{ data: Workflow[]; total: number }>(`/applications/${appId}/workflows`);
      setWorkflows(Array.isArray(res) ? res : res.data);
    } catch (err: any) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error && !appId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">{error}</div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    DRAFT: 'bg-gray-100 text-gray-600',
    DISABLED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          <p className="text-sm text-gray-500 mt-1">Design and manage integration workflows</p>
        </div>
        <Link
          href={`/workflows/new?appId=${appId}`}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          + New Workflow
        </Link>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 mb-4">{error}</div>}

      {workflows.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">No workflows yet. Create your first workflow to get started.</p>
          <Link
            href={`/workflows/new?appId=${appId}`}
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
          >
            Create Workflow
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trigger</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {workflows.map((wf) => (
                <tr key={wf.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      href={`/workflows/${wf.id}?appId=${appId}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {wf.name}
                    </Link>
                    {wf.description && <p className="text-xs text-gray-500 mt-0.5">{wf.description}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{wf.triggerType}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">v{wf.version}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${statusColors[wf.status] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {wf.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(wf.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
