/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // warm off-white "paper" surface — never pure white
        paper:  { DEFAULT: '#F3EEE1', 1: '#ECE4D1', 2: '#E1D5B8', 3: '#D6C7A3' },
        // warm near-black ink — never pure #000, keeps the paper's warmth
        ink:    { DEFAULT: '#18130F', 1: '#241C15', 2: '#332819', dim: '#5A4E3F', muted: '#8C7F6A' },
        // treasure gold — the signature accent (★ motif, badges, hover states)
        gold:   { DEFAULT: '#E3A72E', 1: '#C88F1F', soft: '#F2D896' },
        // rust/coral — secondary accent for contrast beats (tags, alt CTAs)
        rust:   { DEFAULT: '#C4522C', 1: '#9E3F20' },
      },
      fontFamily: {
        // characterful geometric display face, used sparingly for headlines
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        // quiet workhorse body face
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // utility face for eyebrows, numbering, tickers, data
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem', letterSpacing: '0.08em' }],
      },
      borderWidth: {
        3: '3px',
      },
      boxShadow: {
        // signature offset "brutalist" shadow — hard edge, no blur
        brut:    '4px 4px 0 0 #18130F',
        'brut-sm': '2px 2px 0 0 #18130F',
        'brut-gold': '4px 4px 0 0 #E3A72E',
      },
      animation: {
        'fade-in':   'fadeIn 0.2s ease-out',
        'slide-up':  'slideUp 0.25s ease-out',
        marquee:     'marquee 22s linear infinite',
        'star-spin': 'starSpin 6s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        starSpin: { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
      },
    },
  },
  plugins: [],
}