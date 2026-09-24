import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

/**
 * Warm Luxe — the public marketing palette. Light-dominant: warm off-white
 * canvas for most surfaces, refined dark navy reserved for nav/footer/CTA
 * moments, gold used sparingly as an accent. Deliberately distinct from the
 * admin dashboard's cooler theme.
 *
 * Theming: structural roles (canvas / surface / hairline / ink / status) are
 * driven by CSS custom properties defined in globals.css, so they flip between
 * the light and dark ("Warm Luxe Noir") themes. The `navy` and `gold` scales
 * stay literal — navy is the deliberate dark feature surface (nav/footer/hero)
 * that should read dark in both themes, and gold's mid/bright accents already
 * carry onto a dark canvas.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--c-surface) / <alpha-value>)',
          soft: 'rgb(var(--c-surface-soft) / <alpha-value>)',
        },
        hairline: 'rgb(var(--c-hairline) / <alpha-value>)',

        /**
         * Per-tenant brand tokens. CSS custom properties are injected by the
         * root layout as space-separated RGB channels so opacity modifiers work.
         * Defaults defined in globals.css fall back to navy and gold-400.
         */
        'brand-primary': 'rgb(var(--c-brand-primary) / <alpha-value>)',
        'brand-accent':  'rgb(var(--c-brand-accent)  / <alpha-value>)',

        navy: {
          DEFAULT: '#0F1E33',
          700: '#1C3050',
          600: '#26405F',
        },

        gold: {
          50: '#FBF6EA',
          100: '#F4E8C9',
          200: '#E2C792',
          300: '#D4B36A',
          400: '#C8A24B',
          500: '#B7902F',
          600: '#9C7A26',
        },

        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          muted: 'rgb(var(--c-ink-muted) / <alpha-value>)',
          strong: 'rgb(var(--c-ink-strong) / <alpha-value>)',
        },

        success: 'rgb(var(--c-success) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
        error: 'rgb(var(--c-error) / <alpha-value>)',
      },

      fontFamily: {
        sans: [
          'var(--font-arabic)',
          'var(--font-sans)',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        display: [
          'var(--font-display)',
          'var(--font-arabic)',
          'system-ui',
          'sans-serif',
        ],
      },

      fontSize: {
        hero: ['clamp(2.75rem, 6vw, 5.25rem)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-1': ['clamp(2.25rem, 4vw, 3.5rem)', { lineHeight: '1.1', letterSpacing: '-0.015em' }],
        'display-2': ['clamp(1.75rem, 3vw, 2.5rem)', { lineHeight: '1.15' }],
      },

      maxWidth: {
        container: '80rem',
      },

      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },

      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 30 51 / 0.04), 0 4px 16px -4px rgb(15 30 51 / 0.06)',
        card: '0 8px 30px -12px rgb(15 30 51 / 0.12)',
        lift: '0 18px 48px -16px rgb(15 30 51 / 0.22)',
        gold: '0 0 0 3px rgb(200 162 75 / 0.20)',
      },

      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },

      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'ken-burns': {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.08)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },

      animation: {
        'fade-up': 'fade-up 600ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'fade-in': 'fade-in 400ms ease-out both',
        'ken-burns': 'ken-burns 14s ease-out forwards',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [forms({ strategy: 'class' })],
};

export default config;
