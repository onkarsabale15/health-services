'use client';

import { useState } from 'react';
import { EHR_VENDORS } from '@hs/bridge-client/fhir';
import type { NodeType } from '@/types';

// ─── Non-FHIR palette items ─────────────────────────────────────────────────

interface PaletteItem {
  type: NodeType;
  label: string;
  icon: string;
  config?: Record<string, any>;
}

const TRIGGER_ITEMS: PaletteItem[] = [
  { type: 'trigger-manual', label: 'Manual Trigger', icon: '\u25B6' },
  { type: 'trigger-webhook', label: 'Webhook Trigger', icon: '\u25B6' },
];

const EHR_ITEMS: PaletteItem[] = [{ type: 'raw-ehr', label: 'Raw EHR Request', icon: '📂' }];

const AI_ITEMS: PaletteItem[] = [{ type: 'llm-prompt', label: 'LLM Prompt', icon: '\u2736' }];

const LOGIC_ITEMS: PaletteItem[] = [
  { type: 'transform', label: 'Transform', icon: '\uFE64\uFE65' },
  { type: 'condition', label: 'Condition', icon: '\u2135' },
  { type: 'set-variable', label: 'Set Variable', icon: '=' },
  { type: 'loop', label: 'Loop', icon: '\u21BB' },
];

const OUTPUT_ITEMS: PaletteItem[] = [{ type: 'output', label: 'Output', icon: '\u2713' }];

// ─── Category themes ─────────────────────────────────────────────────────────

const categoryTheme: Record<string, { header: string; item: string; icon: string }> = {
  Triggers: {
    header: 'text-purple-600 border-purple-100 bg-purple-50',
    item: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100',
    icon: 'bg-purple-100 text-purple-600',
  },
  EHR: {
    header: 'text-blue-600 border-blue-100 bg-blue-50',
    item: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
    icon: 'bg-blue-100 text-blue-600',
  },
  AI: {
    header: 'text-amber-600 border-amber-100 bg-amber-50',
    item: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
    icon: 'bg-amber-100 text-amber-600',
  },
  Logic: {
    header: 'text-slate-600 border-slate-100 bg-slate-50',
    item: 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100',
    icon: 'bg-slate-100 text-slate-600',
  },
  Output: {
    header: 'text-green-600 border-green-100 bg-green-50',
    item: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
    icon: 'bg-green-100 text-green-600',
  },
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface NodePaletteProps {
  workflowEhr: string;
  onEhrChange: (ehr: string) => void;
  ehrLocked?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function NodePalette({ workflowEhr, onEhrChange, ehrLocked }: NodePaletteProps) {
  function onDragStart(event: React.DragEvent, type: string, label: string, config?: Record<string, any>) {
    event.dataTransfer.setData('application/workflow-node-type', type);
    event.dataTransfer.setData('application/workflow-node-label', label);
    if (config) {
      event.dataTransfer.setData('application/workflow-node-config', JSON.stringify(config));
    }
    event.dataTransfer.effectAllowed = 'move';
  }

  function renderDraggableItem(
    key: string,
    type: string,
    label: string,
    icon: string,
    theme: { item: string; icon: string },
    config?: Record<string, any>,
    subtitle?: string,
  ) {
    return (
      <div
        key={key}
        draggable
        onDragStart={(e) => onDragStart(e, type, label, config)}
        className={[
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs',
          'cursor-grab active:cursor-grabbing',
          'shadow-sm hover:shadow-md',
          'transition-all duration-150 hover:scale-[1.02]',
          theme.item,
        ].join(' ')}
      >
        <span
          className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-semibold shrink-0 ${theme.icon}`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <span className="font-medium truncate block">{label}</span>
          {subtitle && <span className="text-[9px] opacity-60 truncate block">{subtitle}</span>}
        </div>
      </div>
    );
  }

  function renderCategory(label: string, items: PaletteItem[]) {
    const theme = categoryTheme[label] ?? categoryTheme.Logic;
    return (
      <div key={label}>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md mb-1.5 border ${theme.header}`}>
          <h4 className="text-[10px] font-bold uppercase tracking-wider">{label}</h4>
        </div>
        <div className="space-y-1 pl-1">
          {items.map((item) => renderDraggableItem(item.type, item.type, item.label, item.icon, theme, item.config))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-56 bg-white border-r border-gray-200 overflow-y-auto shrink-0 flex flex-col">
      {/* Palette header */}
      <div className="px-3 py-3 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white">
        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Node Palette</h3>
        <p className="text-[10px] text-gray-400 mt-0.5">Drag nodes onto the canvas</p>
      </div>

      {/* EHR selector — locked badge when app has a configured EHR, dropdown otherwise */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">EHR Vendor</label>
        {ehrLocked && workflowEhr ? (
          <div className="flex items-center gap-1.5">
            <span className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-md capitalize">
              {EHR_VENDORS.find((v) => v.id === workflowEhr)?.label || workflowEhr}
            </span>
            <span className="text-[9px] text-gray-400">locked</span>
          </div>
        ) : (
          <>
            <select
              value={workflowEhr}
              onChange={(e) => onEhrChange(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="">From trigger / select...</option>
              {EHR_VENDORS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            {!workflowEhr && (
              <p className="text-[9px] text-amber-600 mt-0.5">EHR must come from trigger or be selected above</p>
            )}
          </>
        )}
      </div>

      <div className="p-3 space-y-4 flex-1">
        {/* Triggers */}
        {renderCategory('Triggers', TRIGGER_ITEMS)}

        {/* EHR section */}
        {renderCategory('EHR', EHR_ITEMS)}

        {/* AI */}
        {renderCategory('AI', AI_ITEMS)}

        {/* Logic */}
        {renderCategory('Logic', LOGIC_ITEMS)}

        {/* Output */}
        {renderCategory('Output', OUTPUT_ITEMS)}
      </div>
    </div>
  );
}
