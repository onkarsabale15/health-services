import { useState, useCallback } from 'react';
import { cdsApi } from '@/lib/api';
import type { CarePlan } from '@/types';

/** Valid target statuses the UI can request. */
export type StatusTransition = 'ACTIVE' | 'COMPLETED' | 'REVOKED' | 'DRAFT';

/**
 * Shared hook for care plan status transitions.
 * Routes to the dedicated endpoint based on the target status:
 *   - DRAFT → ACTIVE: POST /:id/approve
 *   - ACTIVE → COMPLETED: POST /:id/complete
 *   - any → REVOKED: POST /:id/revoke { reason }
 */
export function useUpdateStatus(onUpdated: (updated: CarePlan) => void) {
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');

  const updateStatus = useCallback(
    async (carePlanId: string, target: StatusTransition, opts?: { revokeReason?: string }) => {
      setUpdatingStatus(true);
      setStatusError('');
      try {
        const updated = await transition(carePlanId, target, opts);
        onUpdated(updated);
      } catch (err: unknown) {
        setStatusError(err instanceof Error ? err.message : 'Failed to update status');
      } finally {
        setUpdatingStatus(false);
      }
    },
    [onUpdated],
  );

  return { updatingStatus, statusError, updateStatus };
}

/** Dispatches the status transition to the right endpoint. */
async function transition(
  carePlanId: string,
  target: StatusTransition,
  opts?: { revokeReason?: string },
): Promise<CarePlan> {
  switch (target) {
    case 'ACTIVE':
      return cdsApi.approveCarePlan(carePlanId);
    case 'COMPLETED':
      return cdsApi.completeCarePlan(carePlanId);
    case 'REVOKED':
      return cdsApi.revokeCarePlan(carePlanId, opts?.revokeReason || 'No reason provided');
    case 'DRAFT':
      // DRAFT is not a valid transition target from the UI — plans start as DRAFT
      // and transition forward. If you need to reset, create a new version instead.
      throw new Error('Cannot transition to DRAFT');
  }
}
