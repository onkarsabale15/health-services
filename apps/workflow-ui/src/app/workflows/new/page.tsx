'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import type { Workflow, WorkflowTemplate } from '@/types';

export default function NewWorkflowPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appId = searchParams.get('appId');
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await api.get<WorkflowTemplate[]>('/workflow-templates');
      setTemplates(data);
    } catch {
      // Templates are optional — don't block the page
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function handleCreateBlank() {
    if (!name.trim() || !appId) return;
    try {
      setCreating(true);
      const wf = await api.post<Workflow>(`/applications/${appId}/workflows`, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast('Workflow created', 'success');
      router.push(`/workflows/${wf.id}?appId=${appId}`);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateFromTemplate(templateId: string) {
    if (!appId) return;
    try {
      setCreating(true);
      const wf = await api.post<Workflow>('/workflow-templates/from-template', {
        templateId,
        applicationId: appId,
        name: name.trim() || undefined,
      });
      toast('Workflow created from template', 'success');
      router.push(`/workflows/${wf.id}?appId=${appId}`);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Workflow</h1>

      {/* Blank workflow */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Blank Workflow</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Care Plan Generator"
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
              rows={2}
              className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleCreateBlank}
            disabled={!name.trim() || creating}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {creating ? 'Creating...' : 'Create Blank Workflow'}
          </button>
        </div>
      </div>

      {/* Templates */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Start from Template</h2>
        {loadingTemplates ? (
          <div className="py-4 text-center text-gray-500 text-sm">Loading templates...</div>
        ) : templates.length === 0 ? (
          <p className="text-gray-500 text-sm">No templates available yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((tpl) => (
              <div key={tpl.id} className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                <h3 className="font-medium text-gray-900">{tpl.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{tpl.description}</p>
                <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mt-2">
                  {tpl.category}
                </span>
                <button
                  onClick={() => handleCreateFromTemplate(tpl.id)}
                  disabled={creating}
                  className="mt-3 w-full bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-200 text-sm disabled:opacity-50"
                >
                  Use Template
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
