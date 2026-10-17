import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import defaultColors from 'tailwindcss/colors';

/** A colour read from a CSS variable of RGB channels, so it can flip in dark mode. */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
/** A scale whose listed steps flip in dark mode; the rest stay fixed. */
const scale = (name: string, steps: number[], fixed: Record<string, string> = {}) => ({
  ...fixed,
  ...Object.fromEntries(steps.map((n) => [n, v(`${name}-${n}`)])),
});

/** Default Tailwind hues whose tints (50–200) and text shades (600–800) flip in dark mode (U5). */
const THEMED_HUES = ['amber', 'emerald', 'red', 'violet', 'sky', 'blue', 'purple', 'indigo', 'teal', 'rose', 'orange', 'cyan', 'green', 'yellow', 'pink', 'lime', 'fuchsia'] as const;
const themedHues = Object.fromEntries(
  THEMED_HUES.map((h) => [h, scale(h, [50, 100, 200, 600, 700, 800], defaultColors[h] as unknown as Record<string, string>)]),
);

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ...themedHues,
        // Warm-luxe palette aligned with the public website ("Warm Luxe").
        // Backgrounds/borders/accents are warm; text stays cool navy (slate)
        // to match the website's cool-navy ink on a warm canvas.
        // Theme-aware surfaces — toggle-controlled via CSS variables.
        // Light: warm off-white. Dark: near-black. All opacity modifiers work.
        canvas: 'rgb(var(--tw-canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--tw-surface) / <alpha-value>)',
          muted:   'rgb(var(--tw-surface-muted) / <alpha-value>)',
          sunken:  'rgb(var(--tw-surface-sunken) / <alpha-value>)',
        },
        hairline: 'rgb(var(--tw-hairline) / <alpha-value>)',

        // Refined dark navy used by the website for nav/footer/CTAs — gives the
        // admin shell the same branded identity.
        // Ink / muted / tracks: the whole slate scale follows the theme (U5),
        // so the existing text-slate-* / bg-slate-* classes work in dark mode.
        slate: scale('slate', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),

        // Unit statuses — one set everywhere (U5).
        unit: {
          sold: v('unit-sold'),
          reserved: v('unit-reserved'),
          available: v('unit-available'),
          'available-text': v('unit-available-text'),
        },

        navy: {
          DEFAULT: '#0E1626',
          band: '#0E1626',
          700: '#1C3050',
          600: '#26405F',
        },

        sidebar: {
          bg: '#0A1120',
          'bg-elev': '#121B2D',
          'bg-hover': '#141E31',
          border: '#060B15',
          text: '#9AA6B6',
          'text-muted': '#6E7C90',
          'text-active': '#FFFFFF',
        },

        // Gold accent matched to the website gold ramp (signature = 500/#C8A24B).
        brand: {
          50: v('brand-50'),
          100: v('brand-100'),
          200: '#E9D49B',
          300: '#DABE6E',
          400: '#CFAE57',
          500: '#C8A24B',
          600: '#AE8835',
          700: v('brand-700'),
          800: '#6E551F',
          900: '#4F3D16',
        },

        accent: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },



        success: scale('success', [50, 100, 600, 700], { 500: '#10B981' }),
        warning: scale('warning', [50, 100, 600, 700], { 500: '#F59E0B' }),
        danger: scale('danger', [50, 100, 600, 700], { 500: '#EF4444' }),
        info: scale('info', [50, 100, 600, 700], { 500: '#3B82F6' }),

        // Semantic text colors for hierarchy and emphasis.
        'text-primary': v('slate-900'),
        'text-secondary': v('slate-500'),
        'text-muted': v('slate-400'),
      },

      fontFamily: {
        // U5: Almarai for text, Noto Naskh Arabic for headings, Cormorant
        // Garamond for large numbers.
        sans: [
          'var(--font-sans)',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        display: ['var(--font-heading)', 'var(--font-sans)', 'serif'],
        heading: ['var(--font-heading)', 'var(--font-sans)', 'serif'],
        numeric: ['var(--font-numeric)', 'var(--font-sans)', 'serif'],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },

      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },

      borderRadius: {
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },

      boxShadow: {
        // Navy-tinted shadows (rgb 15 30 51) to match the website's warm depth.
        xs: '0 1px 2px 0 rgb(15 30 51 / 0.04)',
        sm: '0 1px 2px 0 rgb(15 30 51 / 0.05), 0 1px 3px 0 rgb(15 30 51 / 0.04)',
        soft: '0 1px 2px 0 rgb(15 30 51 / 0.04), 0 4px 16px -4px rgb(15 30 51 / 0.06)',
        md: '0 2px 4px -1px rgb(15 30 51 / 0.06), 0 4px 8px -2px rgb(15 30 51 / 0.06)',
        card: '0 8px 30px -12px rgb(15 30 51 / 0.12)',
        lg: '0 4px 8px -2px rgb(15 30 51 / 0.06), 0 10px 20px -4px rgb(15 30 51 / 0.08)',
        lift: '0 18px 48px -16px rgb(15 30 51 / 0.20)',
        xl: '0 12px 24px -6px rgb(15 30 51 / 0.10), 0 20px 40px -8px rgb(15 30 51 / 0.12)',
        ring: '0 0 0 3px rgb(200 162 75 / 0.20)',
      },

      ringColor: {
        DEFAULT: '#C8A24B',
      },

      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },

      transitionDuration: {
        DEFAULT: '150ms',
      },

      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },

      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        'fade-in': 'fade-in 200ms ease-out',
      },
    },
  },
  plugins: [forms({ strategy: 'class' })],
};

export default config;
