import { useState, useCallback } from 'react';
import { cdsApi } from '@/lib/api';
import type { CdsCard, CarePlan } from '@/types';

/**
 * Shared hook for inline editing of care plan cards.
 * Used by both the analysis page and the care plan detail page.
 */
export function useCarePlanEditing(onSaved: (updated: CarePlan) => void) {
  const [editing, setEditing] = useState(false);
  const [editCards, setEditCards] = useState<CdsCard[]>([]);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const startEditing = useCallback((cards: CdsCard[]) => {
    setEditCards([...cards]);
    setEditing(true);
    setEditError('');
  }, []);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setEditCards([]);
    setEditError('');
  }, []);

  const saveEdits = useCallback(
    async (carePlanId: string) => {
      const validCards = editCards.filter((c) => c.summary.trim());
      if (validCards.length === 0) {
        setEditError('At least one recommendation with a summary is required');
        return;
      }
      setSaving(true);
      try {
        const updated = await cdsApi.updateCarePlan(carePlanId, { cards: validCards });
        onSaved(updated);
        setEditing(false);
        setEditCards([]);
      } catch (err: unknown) {
        setEditError(err instanceof Error ? err.message : 'Failed to save changes');
      } finally {
        setSaving(false);
      }
    },
    [editCards, onSaved],
  );

  return {
    editing,
    editCards,
    saving,
    editError,
    setEditCards,
    startEditing,
    cancelEditing,
    saveEdits,
  };
}
