import { CdsCardArraySchema, CdsCard } from '../cds-engine.types';

export function parseCards(raw: string): CdsCard[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }

  const result = CdsCardArraySchema.safeParse(parsed);
  if (!result.success) {
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          const single = CdsCardArraySchema.element.safeParse(item);
          return single.success ? single.data : null;
        })
        .filter((c): c is CdsCard => c !== null);
    }
    return [];
  }

  return result.data;
}
