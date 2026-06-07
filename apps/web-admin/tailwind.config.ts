import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm-luxe palette aligned with the public website ("Warm Luxe").
        // Backgrounds/borders/accents are warm; text stays cool navy (slate)
        // to match the website's cool-navy ink on a warm canvas.
        canvas: '#FAF7F2',
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F4EFE8',
          sunken: '#EAE2D6',
        },
        hairline: '#E7DFD3',

        // Refined dark navy used by the website for nav/footer/CTAs — gives the
        // admin shell the same branded identity.
        navy: {
          DEFAULT: '#0F1E33',
          700: '#1C3050',
          600: '#26405F',
        },

        sidebar: {
          bg: '#0F1E33',
          'bg-elev': '#1C3050',
          'bg-hover': '#1A2A45',
          border: '#0A1626',
          text: '#9AA6B6',
          'text-muted': '#6E7C90',
          'text-active': '#FFFFFF',
        },

        // Gold accent matched to the website gold ramp (signature = 500/#C8A24B).
        brand: {
          50: '#FBF6EA',
          100: '#F5E9CC',
          200: '#E9D49B',
          300: '#DABE6E',
          400: '#CFAE57',
          500: '#C8A24B',
          600: '#AE8835',
          700: '#8E6E29',
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

        // Purple tone for stat card variations and accents.
        purple: {
          50: '#F3E8FF',
          100: '#E9D5FF',
          200: '#D8B4FE',
          500: '#A855F7',
          600: '#9333EA',
          700: '#7E22CE',
        },

        // Teal/cyan tone for stat card variations and accents.
        teal: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
        },

        success: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        danger: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
        info: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },

        // Semantic text colors for hierarchy and emphasis.
        'text-primary': '#0F1E33',
        'text-secondary': '#64748B',
        'text-muted': '#94A3B8',
      },

      fontFamily: {
        sans: [
          'var(--font-sans)',
          'var(--font-arabic)',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        display: [
          'var(--font-sans)',
          'var(--font-arabic)',
          'system-ui',
          'sans-serif',
        ],
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
