'use client';

import { Search } from 'lucide-react';

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/50" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-container-lowest shadow-ambient text-sm text-surface-on placeholder:text-secondary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary/40 hover:text-secondary text-xs"
        >
          Clear
        </button>
      )}
    </div>
  );
}
