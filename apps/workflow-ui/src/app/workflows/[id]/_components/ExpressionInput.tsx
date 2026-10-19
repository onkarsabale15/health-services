'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { WorkflowNode } from '@/types';

// ─── Suggestion types ────────────────────────────────────────────────────────

export interface Suggestion {
  /** What gets inserted (e.g. "{{nodes.search-patient.output}}") */
  value: string;
  /** Display label (e.g. "Search Patient output") */
  label: string;
  /** Grouping label (e.g. "Node Outputs", "Trigger", "Variables") */
  group: string;
  /** Secondary label (e.g. "fhir search") */
  detail?: string;
  /** Nested sub-paths the user can drill into */
  children?: Suggestion[];
}

// ─── Build suggestions from workflow context ──────────────────────────────

export function useSuggestions(currentNodeId: string, allNodes: WorkflowNode[]): Suggestion[] {
  return useMemo(() => {
    const suggestions: Suggestion[] = [];

    // 1. Trigger input
    const triggerNode = allNodes.find((n) => n.type.startsWith('trigger-'));
    if (triggerNode) {
      suggestions.push({
        value: '{{trigger.output}}',
        label: 'Trigger input (full)',
        group: 'Trigger',
        detail: triggerNode.type.replace(/-/g, ' '),
      });

      // If trigger has inputSchema, suggest individual fields
      const schema = triggerNode.config?.inputSchema;
      if (schema && typeof schema === 'object') {
        for (const field of Object.keys(schema)) {
          suggestions.push({
            value: `{{trigger.output.${field}}}`,
            label: field,
            group: 'Trigger Fields',
            detail: typeof schema[field]?.type === 'string' ? schema[field].type : 'any',
          });
        }
      }
    }

    // 2. Node outputs (other nodes)
    for (const node of allNodes) {
      if (node.id === currentNodeId) continue;

      const nodeLabel = node.label || node.id;
      const baseExpr = `{{nodes.${node.id}.output}}`;

      suggestions.push({
        value: baseExpr,
        label: `${nodeLabel} (full output)`,
        group: 'Node Outputs',
        detail: node.type.replace(/-/g, ' '),
      });

      // Smart sub-paths based on node type
      if (node.type === 'raw-ehr') {
        // Generic hints for raw EHR responses
        suggestions.push({
          value: `{{nodes.${node.id}.output.id}}`,
          label: `${nodeLabel}.id`,
          group: 'Node Outputs',
          detail: 'common property',
        });
      } else if (node.type === 'transform' && node.config?.mappings?.length) {
        for (const m of node.config.mappings) {
          if (m.outputField) {
            suggestions.push({
              value: `{{nodes.${node.id}.output.${m.outputField}}}`,
              label: `${nodeLabel}.${m.outputField}`,
              group: 'Node Outputs',
              detail: 'transform field',
            });
          }
        }
      } else if (node.type === 'llm-prompt') {
        suggestions.push({
          value: `{{nodes.${node.id}.output.content}}`,
          label: `${nodeLabel}.content`,
          group: 'Node Outputs',
          detail: 'LLM response text',
        });
      } else if (node.type === 'set-variable' && node.config?.name) {
        // set-variable creates a named variable
        suggestions.push({
          value: `{{vars.${node.config.name}}}`,
          label: node.config.name,
          group: 'Variables',
          detail: 'set-variable',
        });
      }
    }

    // 3. Loop context (if inside a loop or loop exists)
    const loopNodes = allNodes.filter((n) => n.type === 'loop');
    for (const loopNode of loopNodes) {
      const itemName = loopNode.config?.itemName || 'item';
      const indexName = loopNode.config?.indexName || 'index';
      suggestions.push({
        value: `{{loop.${itemName}}}`,
        label: `Current loop item (${itemName})`,
        group: 'Loop',
        detail: loopNode.label || 'loop',
      });
      suggestions.push({
        value: `{{loop.${indexName}}}`,
        label: `Current loop index (${indexName})`,
        group: 'Loop',
        detail: loopNode.label || 'loop',
      });
    }

    return suggestions;
  }, [currentNodeId, allNodes]);
}

// ─── Autocomplete input component ──────────────────────────────────────────

interface ExpressionInputProps {
  value: string;
  onChange: (v: string) => void;
  allNodes: WorkflowNode[];
  currentNodeId: string;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
}

export function ExpressionInput({
  value,
  onChange,
  allNodes,
  currentNodeId,
  placeholder,
  className,
  multiline,
  rows,
}: ExpressionInputProps) {
  const suggestions = useSuggestions(currentNodeId, allNodes);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Filter suggestions based on what user typed after {{
  const filtered = useMemo(() => {
    if (!filter) return suggestions;
    const lower = filter.toLowerCase();
    return suggestions.filter(
      (s) =>
        s.label.toLowerCase().includes(lower) ||
        s.value.toLowerCase().includes(lower) ||
        s.group.toLowerCase().includes(lower) ||
        (s.detail?.toLowerCase().includes(lower) ?? false),
    );
  }, [suggestions, filter]);

  // Group filtered suggestions
  const grouped = useMemo(() => {
    const groups: Record<string, Suggestion[]> = {};
    for (const s of filtered) {
      if (!groups[s.group]) groups[s.group] = [];
      groups[s.group].push(s);
    }
    return groups;
  }, [filtered]);

  // Flat list for keyboard nav
  const flatList = useMemo(() => {
    const result: Suggestion[] = [];
    for (const group of Object.values(grouped)) {
      result.push(...group);
    }
    return result;
  }, [grouped]);

  // Detect {{ trigger
  const detectTrigger = useCallback((inputValue: string, cursorPos: number) => {
    // Find the last {{ before cursor
    const beforeCursor = inputValue.slice(0, cursorPos);
    const lastOpen = beforeCursor.lastIndexOf('{{');
    if (lastOpen === -1) return null;

    // Check if there's a closing }} between {{ and cursor
    const afterOpen = beforeCursor.slice(lastOpen + 2);
    if (afterOpen.includes('}}')) return null;

    return {
      start: lastOpen,
      query: afterOpen,
    };
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      const cursorPos = e.target.selectionStart || 0;
      const trigger = detectTrigger(newValue, cursorPos);

      if (trigger) {
        setFilter(trigger.query);
        setIsOpen(true);
        setSelectedIdx(0);
      } else {
        setIsOpen(false);
        setFilter('');
      }
    },
    [onChange, detectTrigger],
  );

  const insertSuggestion = useCallback(
    (suggestion: Suggestion) => {
      const el = inputRef.current;
      if (!el) return;

      const cursorPos = el.selectionStart || value.length;
      const trigger = detectTrigger(value, cursorPos);

      if (trigger) {
        // Replace from {{ to cursor with the suggestion value
        const before = value.slice(0, trigger.start);
        const after = value.slice(cursorPos);
        const newValue = before + suggestion.value + after;
        onChange(newValue);

        // Move cursor after inserted expression
        requestAnimationFrame(() => {
          const newPos = trigger.start + suggestion.value.length;
          el.setSelectionRange(newPos, newPos);
          el.focus();
        });
      } else {
        // No active trigger — just append
        onChange(value + suggestion.value);
      }

      setIsOpen(false);
      setFilter('');
    },
    [value, onChange, detectTrigger],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || flatList.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIdx((i) => Math.min(i + 1, flatList.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIdx((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
        case 'Tab':
          if (flatList[selectedIdx]) {
            e.preventDefault();
            insertSuggestion(flatList[selectedIdx]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    },
    [isOpen, flatList, selectedIdx, insertSuggestion],
  );

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const baseClasses = `w-full border rounded-md px-2 py-1.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 ${className || ''}`;

  return (
    <div ref={containerRef} className="relative">
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            const trigger = detectTrigger(value, inputRef.current?.selectionStart || 0);
            if (trigger) {
              setFilter(trigger.query);
              setIsOpen(true);
            }
          }}
          rows={rows || 3}
          placeholder={placeholder}
          className={baseClasses}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            const trigger = detectTrigger(value, inputRef.current?.selectionStart || 0);
            if (trigger) {
              setFilter(trigger.query);
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className={baseClasses}
        />
      )}

      {/* Hint */}
      <p className="text-[9px] text-gray-400 mt-0.5">
        Type <code className="bg-gray-100 px-0.5 rounded">{'{{'}</code> to see available data
      </p>

      {/* Autocomplete dropdown */}
      {isOpen && flatList.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="px-2.5 py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 sticky top-0">
                {group}
              </div>
              {items.map((item) => {
                const idx = flatList.indexOf(item);
                return (
                  <button
                    key={item.value}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault(); // prevent blur
                      insertSuggestion(item);
                    }}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2 transition-colors ${
                      idx === selectedIdx ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-gray-800 truncate">{item.label}</div>
                      <div className="text-[9px] text-gray-400 font-mono truncate">{item.value}</div>
                    </div>
                    {item.detail && <span className="text-[9px] text-gray-400 shrink-0">{item.detail}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
