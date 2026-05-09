import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F4F7FB',
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F1F5F9',
          sunken: '#E2E8F0',
        },
        hairline: '#E5EAF0',

        sidebar: {
          bg: '#1E3348',
          'bg-elev': '#263F59',
          'bg-hover': '#22384F',
          border: '#152538',
          text: '#A8B5C8',
          'text-muted': '#7A8AA0',
          'text-active': '#FFFFFF',
        },

        brand: {
          50: '#FBF7EE',
          100: '#F4EAD0',
          200: '#EAD9A6',
          300: '#DDC275',
          400: '#D2AD52',
          500: '#C99A2E',
          600: '#B7873A',
          700: '#9C6E2A',
          800: '#7E5821',
          900: '#5C3F18',
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
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        sm: '0 1px 2px 0 rgb(15 23 42 / 0.05), 0 1px 3px 0 rgb(15 23 42 / 0.04)',
        md: '0 2px 4px -1px rgb(15 23 42 / 0.06), 0 4px 8px -2px rgb(15 23 42 / 0.06)',
        lg: '0 4px 8px -2px rgb(15 23 42 / 0.06), 0 10px 20px -4px rgb(15 23 42 / 0.08)',
        xl: '0 12px 24px -6px rgb(15 23 42 / 0.10), 0 20px 40px -8px rgb(15 23 42 / 0.12)',
        ring: '0 0 0 3px rgb(201 154 46 / 0.18)',
      },

      ringColor: {
        DEFAULT: '#C99A2E',
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
