import nextPlugin from '@next/eslint-plugin-next';
import hooksPlugin from 'eslint-plugin-react-hooks';
import reactPlugin from 'eslint-plugin-react';
import rootConfig from '../../eslint.config.mjs';

const REACT_AND_DOM_GLOBALS = {
  React: 'readonly',
  JSX: 'readonly',
  RequestInit: 'readonly',
  ResponseInit: 'readonly',
  HeadersInit: 'readonly',
  BodyInit: 'readonly',
  HTMLElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLButtonElement: 'readonly',
  HTMLDivElement: 'readonly',
  HTMLAnchorElement: 'readonly',
  HTMLFormElement: 'readonly',
  HTMLSelectElement: 'readonly',
  HTMLTextAreaElement: 'readonly',
  HTMLImageElement: 'readonly',
  HTMLTableElement: 'readonly',
  HTMLLabelElement: 'readonly',
  HTMLSpanElement: 'readonly',
  Element: 'readonly',
  Event: 'readonly',
  KeyboardEvent: 'readonly',
  MouseEvent: 'readonly',
  FocusEvent: 'readonly',
  ChangeEvent: 'readonly',
  SubmitEvent: 'readonly',
  DragEvent: 'readonly',
  Node: 'readonly',
  NodeList: 'readonly',
  MutationObserver: 'readonly',
  ResizeObserver: 'readonly',
  IntersectionObserver: 'readonly',
};

const config = [
  ...rootConfig,
  {
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  {
    plugins: { 'react-hooks': hooksPlugin },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: REACT_AND_DOM_GLOBALS },
  },
  {
    plugins: { react: reactPlugin },
    rules: {
      // No next/image migration yet across existing pages — warn only.
      '@next/next/no-img-element': 'warn',
      // Brownfield link in CRM filter component — flag, don't block.
      '@next/next/no-html-link-for-pages': 'warn',
      // React 19 + Next 15 don't require explicit React import.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Brownfield — keep loud rules as warnings.
      'react/no-unescaped-entities': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

export default config;
