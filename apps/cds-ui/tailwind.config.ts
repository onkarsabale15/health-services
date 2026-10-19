import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2b5bb5',
          dim: '#1a4ea8',
          container: '#d9e2ff',
          on: '#f7f7ff',
        },
        surface: {
          DEFAULT: '#f8f9ff',
          bright: '#f8f9ff',
          dim: '#c4dcff',
          container: {
            lowest: '#ffffff',
            low: '#eff4ff',
            DEFAULT: '#e5eeff',
            high: '#dce9ff',
            highest: '#d2e4ff',
          },
          variant: '#d2e4ff',
          on: '#00345e',
          'on-variant': '#26619d',
        },
        secondary: { DEFAULT: '#526074', container: '#d5e3fc' },
        error: { DEFAULT: '#9f403d', container: '#fe8983' },
        outline: { DEFAULT: '#477dbb', variant: '#81b5f6' },
        // Launch mode accents
        mode: {
          ehr: '#16a34a', // green — EHR launch
          standalone: '#7c3aed', // violet — standalone
          system: '#0891b2', // cyan — system mode
        },
        // Care plan statuses
        status: {
          draft: '#64748b',
          active: '#059669',
          completed: '#2563eb',
          revoked: '#dc2626',
        },
        // CDS card severities
        severity: {
          critical: '#dc2626',
          high: '#ea580c',
          medium: '#ca8a04',
          low: '#0284c7',
          info: '#64748b',
        },
        // AI accent
        accent: { DEFAULT: '#7c3aed', container: '#ede9fe' },
        success: { DEFAULT: '#059669', container: '#d1fae5' },
        warning: { DEFAULT: '#d97706', container: '#fed7aa' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: {
        ambient: '0 12px 40px rgba(0, 52, 94, 0.06)',
        elevated: '0 2px 8px rgba(0, 52, 94, 0.06), 0 8px 32px rgba(0, 52, 94, 0.04)',
        floating: '0 4px 16px rgba(0, 52, 94, 0.08), 0 16px 48px rgba(0, 52, 94, 0.06)',
        glow: '0 0 0 4px rgba(43, 91, 181, 0.12)',
      },
      borderRadius: { 'round-four': '0.375rem' },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        pop: 'pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        pop: {
          '0%': { transform: 'scale(0.92)', opacity: '0' },
          '60%': { transform: 'scale(1.03)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
