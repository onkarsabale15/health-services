import { useState, useCallback } from 'react';
import { cdsApi } from '@/lib/api';

/**
 * Shared hook for exporting a care plan as PDF.
 * Returns { exporting, handleExportPdf, exportError }.
 */
export function useExportPdf() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const handleExportPdf = useCallback(async (carePlanId: string) => {
    setExporting(true);
    setExportError('');
    try {
      const result = await cdsApi.exportCarePlanPdf(carePlanId);
      window.open(result.downloadUrl, '_blank');
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, handleExportPdf, exportError };
}
