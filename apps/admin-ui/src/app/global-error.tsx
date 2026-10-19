'use client';

import { useEffect } from 'react';
import { recordBrowserException } from '@hs/observability-web';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    recordBrowserException(error, error.digest ? { 'error.digest': error.digest } : undefined);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <button onClick={() => reset()} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
