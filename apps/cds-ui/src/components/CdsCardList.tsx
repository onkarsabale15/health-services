'use client';

import { useState } from 'react';
import type { CdsCard } from '@/types';
import {
  SEVERITY_ORDER,
  SEVERITY_STYLES,
  CATEGORY_LABELS,
  SEVERITY_OPTIONS,
  CATEGORY_OPTIONS,
} from '@/lib/cds-constants';

// ── Read-Only Card ──────────────────────────────────────────

function CdsCardItem({ card }: { card: CdsCard }) {
  const [expanded, setExpanded] = useState(card.severity === 'critical');
  const style = SEVERITY_STYLES[card.severity] || SEVERITY_STYLES.info;

  return (
    <div className={`aegis-card ${style.border} p-4`}>
      <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`badge ${style.badge}`}>{card.severity}</span>
            <span className="badge bg-surface-container-high text-secondary">
              {CATEGORY_LABELS[card.category] || card.category}
            </span>
          </div>
          <p className="font-medium text-surface-on">{card.summary}</p>
        </div>
        <button className="text-secondary hover:text-surface-on text-sm ml-2 shrink-0">
          {expanded ? 'Hide' : 'Show'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-secondary">{card.detail}</p>

          {card.suggestions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">Suggestions</p>
              <ul className="space-y-1">
                {card.suggestions.map((s, i) => (
                  <li key={i} className="text-sm text-surface-on flex items-start gap-2">
                    <span className="text-primary mt-0.5">-</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {card.references && card.references.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">References</p>
              <ul className="space-y-0.5">
                {card.references.map((r, i) => (
                  <li key={i} className="text-xs text-secondary">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Editable Card ───────────────────────────────────────────

function EditableCardItem({
  card,
  index,
  onChange,
  onRemove,
}: {
  card: CdsCard;
  index: number;
  onChange: (updated: CdsCard) => void;
  onRemove: () => void;
}) {
  const style = SEVERITY_STYLES[card.severity] || SEVERITY_STYLES.info;

  const updateField = <K extends keyof CdsCard>(field: K, value: CdsCard[K]) => {
    onChange({ ...card, [field]: value });
  };

  const updateSuggestion = (i: number, value: string) => {
    const updated = [...card.suggestions];
    updated[i] = value;
    updateField('suggestions', updated);
  };

  const removeSuggestion = (i: number) => {
    updateField(
      'suggestions',
      card.suggestions.filter((_, idx) => idx !== i),
    );
  };

  const addSuggestion = () => {
    updateField('suggestions', [...card.suggestions, '']);
  };

  return (
    <div className={`aegis-card ${style.border} p-4 ring-1 ring-primary/20`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={card.severity}
            onChange={(e) => updateField('severity', e.target.value as CdsCard['severity'])}
            className="text-xs border rounded-md px-2 py-1 bg-surface-container-lowest text-surface-on focus:ring-1 focus:ring-primary"
          >
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={card.category}
            onChange={(e) => updateField('category', e.target.value as CdsCard['category'])}
            className="text-xs border rounded-md px-2 py-1 bg-surface-container-lowest text-surface-on focus:ring-1 focus:ring-primary"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-secondary">#{index + 1}</span>
        </div>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600 shrink-0 p-0.5" title="Remove card">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            delete
          </span>
        </button>
      </div>

      {/* Summary */}
      <div className="mb-3">
        <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider block mb-1">Summary</label>
        <input
          type="text"
          value={card.summary}
          onChange={(e) => updateField('summary', e.target.value)}
          maxLength={140}
          className="w-full border rounded-lg px-3 py-2 text-sm text-surface-on focus:ring-1 focus:ring-primary focus:border-primary"
        />
      </div>

      {/* Detail */}
      <div className="mb-3">
        <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider block mb-1">Detail</label>
        <textarea
          value={card.detail}
          onChange={(e) => updateField('detail', e.target.value)}
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm text-surface-on focus:ring-1 focus:ring-primary focus:border-primary resize-none"
        />
      </div>

      {/* Suggestions */}
      <div>
        <label className="text-[10px] font-semibold text-secondary uppercase tracking-wider block mb-1">
          Suggestions
        </label>
        <div className="space-y-1.5">
          {card.suggestions.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-secondary shrink-0">{i + 1}.</span>
              <input
                type="text"
                value={s}
                onChange={(e) => updateSuggestion(i, e.target.value)}
                maxLength={100}
                className="flex-1 border rounded-lg px-2.5 py-1.5 text-sm text-surface-on focus:ring-1 focus:ring-primary focus:border-primary"
              />
              <button
                onClick={() => removeSuggestion(i)}
                className="text-red-400 hover:text-red-600 shrink-0"
                title="Remove suggestion"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  close
                </span>
              </button>
            </div>
          ))}
          {card.suggestions.length < 3 && (
            <button
              onClick={addSuggestion}
              className="text-xs text-primary hover:text-primary-dim flex items-center gap-1"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                add
              </span>
              Add suggestion
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────

interface CdsCardListProps {
  cards: CdsCard[];
  editable?: boolean;
  onCardsChange?: (cards: CdsCard[]) => void;
}

export default function CdsCardList({ cards, editable, onCardsChange }: CdsCardListProps) {
  const sorted = [...cards].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  if (!sorted.length && !editable) {
    return (
      <div className="aegis-card p-8 text-center">
        <p className="text-secondary">No clinical recommendations generated.</p>
      </div>
    );
  }

  if (editable && onCardsChange) {
    const handleChange = (index: number, updated: CdsCard) => {
      const next = [...cards];
      next[index] = updated;
      onCardsChange(next);
    };

    const handleRemove = (index: number) => {
      onCardsChange(cards.filter((_, i) => i !== index));
    };

    const handleAdd = () => {
      onCardsChange([
        ...cards,
        {
          category: 'pcp-suggestion',
          severity: 'info',
          summary: '',
          detail: '',
          suggestions: [''],
        },
      ]);
    };

    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">
          Editing Recommendations ({cards.length})
        </h3>
        {cards.map((card, i) => (
          <EditableCardItem
            key={i}
            card={card}
            index={i}
            onChange={(updated) => handleChange(i, updated)}
            onRemove={() => handleRemove(i)}
          />
        ))}
        <button
          onClick={handleAdd}
          className="w-full py-3 border-2 border-dashed border-surface-container-high rounded-xl text-sm text-secondary hover:text-primary hover:border-primary/40 transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            add_circle
          </span>
          Add Recommendation
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">
        AI Recommendations ({sorted.length})
      </h3>
      {sorted.map((card, i) => (
        <CdsCardItem key={i} card={card} />
      ))}
    </div>
  );
}
