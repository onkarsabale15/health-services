import { CdsCard } from '../cds-engine.types';

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function mergeCards(cards: CdsCard[]): CdsCard[] {
  const seen = new Map<string, CdsCard>();
  for (const card of cards) {
    const key = `${card.category}:${card.summary.toLowerCase().trim()}`;
    const existing = seen.get(key);
    if (!existing || SEVERITY_ORDER[card.severity] < SEVERITY_ORDER[existing.severity]) {
      seen.set(key, card);
    }
  }

  return Array.from(seen.values()).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
