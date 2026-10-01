import type { Config } from 'tailwindcss'
// Palette: bay water, sea-foam, tricycle yellow, reef green. Cool base on purpose (not cream).
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { ink: '#0D1F2D', sea: '#0A4D68', foam: '#EEF5F3', sun: '#FFC20E', reef: '#1FA37A' },
    fontFamily: { display: ['var(--font-display)', 'system-ui', 'sans-serif'], sans: ['var(--font-body)', 'system-ui', 'sans-serif'] },
  } },
  plugins: [],
} satisfies Config
