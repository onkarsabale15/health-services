'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  applicationControllerGetApplicationDetail,
  ehrConfigControllerGetDefinitions,
  ehrConfigControllerGetAllPlatformScopes,
} from '@/lib/sdk/generated';
import { getUser } from '@/lib/auth';
import { useToast } from '@/components/toast';
import { getAppTypeDefinition } from '@hs/config';
import EhrIntegrationsTab from './_components/EhrIntegrationsTab';
import WorkflowsTab from './_components/WorkflowsTab';
import LLMConfigTab from './_components/LLMConfigTab';
import EndUsersTab from './_components/EndUsersTab';

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const appId = params.id as string;
  const currentUser = getUser();
  const { toast } = useToast();

  const [app, setApp] = useState<any>(null);
  const [accessLevel, setAccessLevel] = useState<'FULL' | 'READONLY'>('FULL');
  const [ehrDefs, setEhrDefs] = useState<any[]>([]);
  const [ehrAccess, setEhrAccess] = useState<any[]>([]);
  const [scopeInfo, setScopeInfo] = useState<{
    scopes: string[];
    capabilities: Record<string, { read: boolean; write: boolean }>;
  } | null>(null);
  const [userAccess, setUserAccess] = useState<any[]>([]);
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'ehr' | 'workflows' | 'cds' | 'llm' | 'end-users'>('ehr');

  const isReadonly = accessLevel === 'READONLY';
  const appTypeDef = app ? getAppTypeDefinition(app.appType) : undefined;
  const showWorkflowsTab = appTypeDef?.supportsWorkflows ?? false;
  const showCdsTab = appTypeDef?.supportsCds ?? false;
  const showLlmTab = appTypeDef?.supportsLlm ?? false;
  const isSingleEhr = appTypeDef ? appTypeDef.maxEhrAccess === 1 : false;

  useEffect(() => {
    Promise.all([loadAppDetail(), loadEhrDefs(), loadScopeInfo()]);
  }, [appId]);

  async function loadAppDetail() {
    try {
      const { data, error: detailError } = await applicationControllerGetApplicationDetail({ path: { id: appId } });
      if (detailError) {
        if ((detailError as any)?.status === 403) {
          toast('You do not have access to this application', 'error');
          router.replace('/dashboard/applications');
          return;
        }
        throw new Error((detailError as any)?.message || 'Failed to load application');
      }
      if (!data) throw new Error('Failed to load application');
      const detail = data as any;
      setApp(detail.app);
      setAccessLevel(detail.app.userAccessLevel || 'FULL');
      setEhrAccess(detail.ehrAccess || []);
      if (detail.userAccess) setUserAccess(detail.userAccess);
      if (detail.orgUsers) setOrgUsers(detail.orgUsers);

      // Default to preferred tab for specialized apps
      const typeDef = getAppTypeDefinition(detail.app.appType);
      if (typeDef?.supportsWorkflows) setActiveTab('workflows');
      else if (typeDef?.supportsCds) setActiveTab('cds');
    } catch (err: any) {
      toast(err.message || 'Failed to load application', 'error');
    }
  }

  async function loadEhrDefs() {
    try {
      const { data } = await ehrConfigControllerGetDefinitions();
      if (data) setEhrDefs(data as any);
    } catch {
      /* non-critical */
    }
  }

  async function loadScopeInfo() {
    try {
      const { data } = await ehrConfigControllerGetAllPlatformScopes();
      if (data) setScopeInfo(data as any);
    } catch {
      /* non-critical */
    }
  }

  if (!app)
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-surface-container-low w-1/3 rounded-round-four" />
        <div className="h-64 bg-surface-container-low w-full rounded-round-four" />
      </div>
    );

  // Check for pending sites across all EHR integrations
  const pendingSites = ehrAccess.flatMap((a: any) =>
    (a.sites || []).filter((s: any) => s.isApproved === false).map((s: any) => ({ ...s, ehrName: a.ehrName })),
  );

  return (
    <div className="space-y-6">
      {/* Pending Sites Approval Banner */}
      {pendingSites.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-yellow-500 text-white p-1 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-yellow-800">
              {pendingSites.length} Site{pendingSites.length > 1 ? 's' : ''} Pending Approval
            </h3>
          </div>
          <p className="text-xs text-yellow-700 mb-2">
            New practice{pendingSites.length > 1 ? 's were' : ' was'} detected from a SMART on FHIR launch and require
            {pendingSites.length === 1 ? 's' : ''} activation:
          </p>
          <div className="space-y-1">
            {pendingSites.map((site: any) => (
              <div key={site.id} className="flex items-center justify-between bg-white/60 rounded px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-yellow-900">{site.name}</span>
                  <span className="text-xs text-yellow-600 capitalize">({site.ehrName})</span>
                </div>
                <Link
                  href={`/dashboard/applications/${appId}/ehr/${site.ehrName}`}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Review & Activate
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Provider Access Reminder (for SMART apps with sites) */}
      {pendingSites.length === 0 && ehrAccess.some((a: any) => (a.sites || []).length > 0) && app.smartLaunchUrl && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-blue-500"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-xs text-blue-700">
              Provider access can be managed per-site in the EHR configuration page. Providers are auto-registered on
              SMART launch.
            </p>
          </div>
        </div>
      )}

      {/* Header & Breadcrumbs */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-surface-on-variant">
          <Link href="/dashboard/applications" className="hover:text-primary transition-colors">
            Applications
          </Link>
          <span className="text-surface-container-highest">/</span>
          <span className="text-surface-on">{app.name}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-surface-on">{app.name}</h1>
            <div className="flex gap-2">
              <span className={`badge ${app.status === 'ACTIVE' ? 'badge-active' : 'badge-disabled'}`}>
                {app.status}
              </span>
              {isReadonly && <span className="badge badge-sandbox">Read Only Access</span>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-secondary uppercase tracking-tighter bg-surface-container-low px-2 py-1 rounded">
              App ID: {app.id.split('-')[0]}...
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation (Aegis Slate Style) */}
      <div className="flex gap-1 bg-surface-container-low/50 p-1 rounded-round-four w-fit border border-surface-container-DEFAULT">
        <button
          onClick={() => setActiveTab('ehr')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-round-four transition-all ${
            activeTab === 'ehr'
              ? 'bg-primary text-white shadow-ambient shadow-primary/20'
              : 'text-surface-on-variant hover:bg-surface-container-DEFAULT'
          }`}
        >
          {isSingleEhr ? 'EHR Integration' : 'EHR Integrations'}
        </button>

        {showWorkflowsTab && (
          <button
            onClick={() => setActiveTab('workflows')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-round-four transition-all ${
              activeTab === 'workflows'
                ? 'bg-primary text-white shadow-ambient shadow-primary/20'
                : 'text-surface-on-variant hover:bg-surface-container-DEFAULT'
            }`}
          >
            Workflows
          </button>
        )}

        {showCdsTab && (
          <button
            onClick={() => setActiveTab('cds')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-round-four transition-all ${
              activeTab === 'cds'
                ? 'bg-primary text-white shadow-ambient shadow-primary/20'
                : 'text-surface-on-variant hover:bg-surface-container-DEFAULT'
            }`}
          >
            CDS Rules
          </button>
        )}

        {showLlmTab && (
          <button
            onClick={() => setActiveTab('llm')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-round-four transition-all ${
              activeTab === 'llm'
                ? 'bg-primary text-white shadow-ambient shadow-primary/20'
                : 'text-surface-on-variant hover:bg-surface-container-DEFAULT'
            }`}
          >
            LLM Keys
          </button>
        )}

        <button
          onClick={() => setActiveTab('end-users')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-round-four transition-all ${
            activeTab === 'end-users'
              ? 'bg-primary text-white shadow-ambient shadow-primary/20'
              : 'text-surface-on-variant hover:bg-surface-container-DEFAULT'
          }`}
        >
          End Users
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
        {activeTab === 'ehr' && (
          <EhrIntegrationsTab
            app={app}
            setApp={setApp}
            appId={appId}
            ehrAccess={ehrAccess}
            setEhrAccess={setEhrAccess}
            ehrDefs={ehrDefs}
            scopeInfo={scopeInfo}
            userAccess={userAccess}
            setUserAccess={setUserAccess}
            orgUsers={orgUsers}
            isReadonly={isReadonly}
            currentUser={currentUser}
            toast={toast}
            isSingleEhr={isSingleEhr}
          />
        )}

        {activeTab === 'workflows' && showWorkflowsTab && (
          <WorkflowsTab app={app} appId={appId} isReadonly={isReadonly} toast={toast} />
        )}

        {activeTab === 'llm' && showLlmTab && <LLMConfigTab appId={appId} isReadonly={isReadonly} toast={toast} />}

        {activeTab === 'end-users' && app && <EndUsersTab appId={appId} appName={app.name} isReadonly={isReadonly} />}

        {activeTab === 'cds' && showCdsTab && (
          <div className="aegis-card p-12 text-center space-y-4 border-2 border-dashed border-surface-container-DEFAULT bg-transparent">
            <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mx-auto text-primary/40">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-8 h-8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.75 3.104v1.244c0 .892-.722 1.615-1.615 1.615H6.89c-.893 0-1.615.723-1.615 1.615V8.84c0 .893-.722 1.615-1.615 1.615H2.415c-.893 0-1.615.722-1.615 1.615v1.244c0 .892.722 1.615 1.615 1.615H3.66c.893 0 1.615.722 1.615 1.615v1.244c0 .892.722 1.615 1.615 1.615h1.244c.893 0 1.615.722 1.615 1.615v1.244c0 .892.722 1.615 1.615 1.615h1.244c.893 0 1.615-.723 1.615-1.615v-1.244c0-.893.722-1.615 1.615-1.615h1.244c.893 0 1.615-.722 1.615-1.615v-1.244c0-.892-.722-1.615-1.615-1.615H14.16c-.893 0-1.615-.722-1.615-1.615v-1.244c0-.892.722-1.615 1.615-1.615h1.244c.893 0 1.615-.722 1.615-1.615v-1.244c0-.892-.722-1.615-1.615-1.615h-1.244c-.893 0-1.615.722-1.615.892-.722.892-1.615.892-1.615v1.244Z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-surface-on">CDS Rules Management</h3>
            <p className="text-sm text-surface-on-variant max-w-md mx-auto">
              This module is currently under development. Soon you will be able to configure AI-powered clinical
              decision support rules directly within the portal.
            </p>
            <button className="btn-secondary opacity-50 cursor-not-allowed">Coming Soon</button>
          </div>
        )}
      </div>
    </div>
  );
}
