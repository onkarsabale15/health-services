'use client';

import { useState } from 'react';
import { EHR_APP_TYPE_META, type EhrAppType } from '@hs/config';
import { Button } from '@/components/button';

interface EhrDef {
  ehrName: string;
  label: string;
  /** Launch modes this EHR supports (e.g. system, provider-ehr, provider-standalone). */
  supportedAppTypes?: string[];
}

interface AddEhrDropdownProps {
  ehrDefs: EhrDef[];
  /** ehrName → app types already configured for this application. */
  configuredAppTypes: Record<string, string[]>;
  /** Launch modes allowed for this application's type (e.g. MCP → ['system']). When set, modes are intersected with each EHR's supported modes. */
  allowedAppTypes?: string[];
  /** Called with the selected EHR + launch mode (app type) when the user picks one. */
  onSelect: (ehrName: string, ehrAppType: string) => void;
}

const DEFAULT_APP_TYPES = ['system'];

/**
 * Dropdown to add an EHR integration. An EHR can be added once **per launch
 * mode** (system / provider-ehr / provider-standalone), so picking an EHR
 * reveals its supported modes with the ones already configured marked.
 * Selecting a mode navigates to that integration (new, or edit if it exists),
 * carrying the `appType` so the config page targets the right record.
 */
export default function AddEhrDropdown({
  ehrDefs,
  configuredAppTypes,
  allowedAppTypes,
  onSelect,
}: AddEhrDropdownProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setExpanded(null);
  }

  function pick(ehrName: string, ehrAppType: string) {
    close();
    onSelect(ehrName, ehrAppType);
  }

  function appTypesFor(def: EhrDef): string[] {
    const supported = def.supportedAppTypes?.length ? def.supportedAppTypes : DEFAULT_APP_TYPES;
    // Restrict to what this application's type permits (e.g. MCP → system only).
    return allowedAppTypes?.length ? supported.filter((m) => allowedAppTypes.includes(m)) : supported;
  }

  return (
    <div className="relative">
      <Button variant="primary" size="sm" onClick={() => setOpen((v) => !v)}>
        + Add EHR
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-20 p-2">
            <p className="text-xs text-gray-500 px-2 pt-1 pb-2 border-b">
              Pick an EHR, then a launch mode. The same EHR can be added once per launch mode.
            </p>
            <div className="max-h-96 overflow-y-auto mt-1">
              {ehrDefs.map((def) => {
                const modes = appTypesFor(def);
                const configured = configuredAppTypes[def.ehrName] ?? [];

                // EHR offers no launch mode this application type permits — hide it.
                if (modes.length === 0) return null;

                // Single-mode EHR: one click selects it directly.
                if (modes.length === 1) {
                  return (
                    <button
                      key={def.ehrName}
                      onClick={() => pick(def.ehrName, modes[0])}
                      className="w-full text-left px-3 py-2 rounded text-sm hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                    >
                      <span className="font-medium">{def.label}</span>
                      {configured.includes(modes[0]) && <span className="text-xs text-blue-600">Configured</span>}
                    </button>
                  );
                }

                // Multi-mode EHR: expand to show launch modes.
                const isExpanded = expanded === def.ehrName;
                return (
                  <div key={def.ehrName}>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : def.ehrName)}
                      className="w-full text-left px-3 py-2 rounded text-sm hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                    >
                      <span className="font-medium">{def.label}</span>
                      <span className="flex items-center gap-2">
                        {configured.length > 0 && (
                          <span className="text-xs text-blue-600">{configured.length} configured</span>
                        )}
                        <span className="text-gray-400 text-xs">{isExpanded ? '▾' : '▸'}</span>
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="ml-2 pl-2 border-l border-gray-100">
                        {modes.map((mode) => {
                          const meta = EHR_APP_TYPE_META[mode as EhrAppType];
                          const isConfigured = configured.includes(mode);
                          return (
                            <button
                              key={mode}
                              onClick={() => pick(def.ehrName, mode)}
                              className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 cursor-pointer"
                            >
                              <span className="flex items-center justify-between">
                                <span className="text-sm">{meta?.label ?? mode}</span>
                                {isConfigured && <span className="text-xs text-blue-600">Configured</span>}
                              </span>
                              {meta?.description && (
                                <span className="block text-xs text-gray-400 mt-0.5">{meta.description}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
