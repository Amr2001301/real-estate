import nextPlugin from '@next/eslint-plugin-next';
import hooksPlugin from 'eslint-plugin-react-hooks';
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
  Element: 'readonly',
  Event: 'readonly',
  KeyboardEvent: 'readonly',
  MouseEvent: 'readonly',
  FocusEvent: 'readonly',
  ChangeEvent: 'readonly',
  SubmitEvent: 'readonly',
  Node: 'readonly',
  IntersectionObserver: 'readonly',
  IntersectionObserverEntry: 'readonly',
  IntersectionObserverInit: 'readonly',
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
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
];

export default config;
