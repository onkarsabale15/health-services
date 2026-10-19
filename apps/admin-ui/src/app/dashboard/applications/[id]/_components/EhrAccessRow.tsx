'use client';

import Link from 'next/link';
import { getEhrAppTypeLabel } from '@hs/config';
import { Button } from '@/components/button';
import { getEffectiveAppType, type EhrAccessLike } from '@/lib/ehr-access';

const APP_TYPE_BADGE_CLASS: Record<string, string> = {
  system: 'bg-slate-100 text-slate-700',
  'provider-ehr': 'bg-blue-100 text-blue-700',
  'provider-standalone': 'bg-purple-100 text-purple-700',
};

interface EhrAccessRowProps {
  access: EhrAccessLike & {
    status: 'ACTIVE' | 'DISABLED';
    ehrTokenScopes?: string[];
    sites?: Array<{ isActive?: boolean; isApproved?: boolean }>;
  };
  appId: string;
  isReadonly: boolean;
  onRemove: (ehrName: string, ehrAppType: string) => void;
  onEnable: (ehrName: string, ehrAppType: string) => void;
}

/** Single row in the "Configured EHRs" list — one per (ehrName, ehrAppType) combo */
export default function EhrAccessRow({ access, appId, isReadonly, onRemove, onEnable }: EhrAccessRowProps) {
  const appType = getEffectiveAppType(access);
  const appTypeLabel = getEhrAppTypeLabel(appType);
  const badgeClass = APP_TYPE_BADGE_CLASS[appType] || 'bg-gray-100 text-gray-700';
  const editUrl = `/dashboard/applications/${appId}/ehr/${access.ehrName}?appType=${appType}`;
  const isActive = access.status === 'ACTIVE';

  const siteInfo = summarizeSites(access.sites);

  return (
    <div className={`flex items-center justify-between border rounded-lg p-4 ${!isActive ? 'opacity-60' : ''}`}>
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium capitalize">{access.ehrName}</p>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${badgeClass}`}>{appTypeLabel}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
          >
            {access.status}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">{access.ehrTokenScopes?.length || 0} EHR token scopes</p>
        {siteInfo.total > 0 && (
          <>
            <p className="text-xs text-gray-500">{siteInfo.active} site(s) configured</p>
            {siteInfo.pending > 0 && (
              <p className="text-xs text-yellow-600 font-medium">{siteInfo.pending} site(s) pending approval</p>
            )}
          </>
        )}
      </div>
      {!isReadonly && (
        <div className="flex items-center gap-3">
          {isActive ? (
            <Button
              variant="link"
              size="sm"
              className="text-red-500 hover:text-red-700"
              confirmMessage={`Disable ${access.ehrName} (${appTypeLabel}) access?`}
              onClick={() => onRemove(access.ehrName, appType)}
            >
              Disable
            </Button>
          ) : (
            <Button
              variant="link"
              size="sm"
              className="text-green-600 hover:text-green-700"
              confirmMessage={`Re-enable ${access.ehrName} (${appTypeLabel}) access?`}
              onClick={() => onEnable(access.ehrName, appType)}
            >
              Enable
            </Button>
          )}
          <Link href={editUrl} className="text-blue-600 hover:underline text-sm">
            Edit
          </Link>
        </div>
      )}
    </div>
  );
}

/** Count active and pending-approval sites from a sites array */
function summarizeSites(sites?: Array<{ isActive?: boolean; isApproved?: boolean }>) {
  if (!sites?.length) return { total: 0, active: 0, pending: 0 };
  return {
    total: sites.length,
    active: sites.filter((s) => s.isActive !== false).length,
    pending: sites.filter((s) => s.isApproved === false).length,
  };
}
