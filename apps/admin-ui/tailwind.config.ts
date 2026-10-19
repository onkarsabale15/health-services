import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Aegis Slate Palette: Primary (Enterprise Blue) & Tonal Surfaces
        primary: {
          DEFAULT: '#2b5bb5',
          dim: '#1a4ea8',
          container: '#d9e2ff',
          on: '#f7f7ff',
          fixed: '#d9e2ff',
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
        secondary: {
          DEFAULT: '#526074',
          container: '#d5e3fc',
          on: '#f8f8ff',
        },
        tertiary: {
          DEFAULT: '#605c78',
          container: '#e2dbfd',
          on: '#fcf7ff',
        },
        error: {
          DEFAULT: '#9f403d',
          container: '#fe8983',
          on: '#fff7f6',
        },
        outline: {
          DEFAULT: '#477dbb',
          variant: '#81b5f6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Ambient Shadows (extra-diffused, using on-surface tint)
        ambient: '0 12px 40px rgba(0, 52, 94, 0.06)',
      },
      borderRadius: {
        'round-four': '0.375rem', // Match Aegis Slate rounding
      },
    },
  },
  plugins: [],
};

export default config;
