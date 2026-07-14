/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:    { DEFAULT: '#0a0a0a', 1: '#111111', 2: '#1a1a1a', 3: '#242424', 4: '#2e2e2e' },
        chalk:  { DEFAULT: '#f5f4f0', 1: '#ede9e0', dim: '#a0998a', muted: '#6b6560' },
        signal: '#22d3a5',
        warn:   '#f59e0b',
        danger: '#ef4444',
        brand:  '#6366f1',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', '1rem'],
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'fade-in':   'fadeIn 0.15s ease-out',
        'slide-up':  'slideUp 0.2s ease-out',
        'pulse-dot': 'pulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
