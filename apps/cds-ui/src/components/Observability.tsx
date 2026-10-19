'use client';

import { useEffect } from 'react';
import { initBrowserOtel } from '@hs/observability-web';

export function Observability() {
  useEffect(() => {
    const CDS_API_URL = process.env.NEXT_PUBLIC_CDS_API_URL || 'http://localhost:3003';

    initBrowserOtel({
      serviceName: 'cds-ui',
      // Ensure headers are sent to our backend
      propagateTraceHeaderCorsUrls: [
        new RegExp(CDS_API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        /localhost/, // Allow local dev
      ],
    });
  }, []);

  return null;
}
