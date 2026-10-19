'use client';

import { useEffect, useState } from 'react';
import { organizationControllerGetMyOrganization } from '@/lib/sdk/generated';

export default function DashboardPage() {
  const [org, setOrg] = useState<any>(null);

  useEffect(() => {
    organizationControllerGetMyOrganization()
      .then(({ data }) => {
        if (data) setOrg(data);
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {org && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Organization</p>
            <p className="text-xl font-semibold mt-1">{org.name}</p>
            {org.domain && <p className="text-sm text-gray-400 mt-1">{org.domain}</p>}
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Applications</p>
            <p className="text-3xl font-semibold mt-1">{org._count?.applications ?? 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Users</p>
            <p className="text-3xl font-semibold mt-1">{org._count?.users ?? 0}</p>
          </div>
        </div>
      )}
    </div>
  );
}
