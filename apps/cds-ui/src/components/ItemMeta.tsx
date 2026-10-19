/**
 * Metadata row for clinical list items — recorded date, last updated, latest note.
 * Shared across conditions, allergies, medications, and vitals cards.
 */
export default function ItemMeta({
  recordedDate,
  lastUpdated,
  notes,
}: {
  recordedDate?: string;
  lastUpdated?: string;
  notes?: string[];
}) {
  const hasAny = recordedDate || lastUpdated || (notes && notes.length > 0);
  if (!hasAny) return null;

  return (
    <div className="mt-1 space-y-0.5">
      {(recordedDate || lastUpdated) && (
        <div className="flex items-center gap-2 text-[10px] text-secondary">
          {recordedDate && <span>Recorded: {recordedDate}</span>}
          {lastUpdated && <span>Updated: {lastUpdated}</span>}
        </div>
      )}
      {notes && notes.length > 0 && (
        <p className="text-[10px] text-secondary/80 italic truncate" title={notes.join(' | ')}>
          {notes[notes.length - 1]}
        </p>
      )}
    </div>
  );
}
