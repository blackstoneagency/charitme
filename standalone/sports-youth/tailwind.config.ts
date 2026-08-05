import type { Config } from 'tailwindcss';

/**
 * Colours sampled from the reference screenshot rather than invented.
 * The page is a dark design: a near-black canvas with a violet-tinted
 * elevated surface for cards, and a violet→magenta→amber CTA gradient.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#05060f',        // page background
        hero: '#0a0618',          // hero band behind the photo scrim
        surface: '#121530',       // card / elevated panel
        'surface-2': '#181c3c',   // hover + secondary panel
        'surface-3': '#1e2348',   // chip / badge plate
        line: '#252948',          // hairline border
        'line-strong': '#303668',
        ink: '#e2e8f8',           // primary text
        'ink-2': '#b8c2de',       // secondary text
        'ink-3': '#8090b5',       // muted text
        brand: '#b9a5ff',         // links / accents on dark
        heart: '#ff4d8d',
        'accent-gear': '#7c3aed',
        'accent-coach': '#db2777',
        'accent-run': '#ea580c',
        'accent-community': '#15803d',
        'accent-learn': '#1d4ed8',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      fontSize: {
        // Matches the reference's type ramp.
        'hero': ['clamp(30px, 4.4vw, 52px)', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '850' }],
        'h2': ['clamp(24px, 3vw, 38px)', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '800' }],
        'stat': ['26px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '850' }],
      },
      borderRadius: { card: '14px', xl2: '20px' },
      boxShadow: {
        card: '0 22px 70px rgba(0,0,0,.5)',
        cta: '0 16px 32px rgba(103,54,255,.4)',
      },
      backgroundImage: {
        'grad-brand': 'linear-gradient(100deg, #6d28d9, #a21caf, #b45309)',
        'hero-scrim': 'linear-gradient(90deg, #0a0618 0%, #0a0618 44%, rgba(10,6,24,.82) 58%, rgba(10,6,24,.35) 100%)',
      },
    },
  },
  plugins: [],
};
export default config;
