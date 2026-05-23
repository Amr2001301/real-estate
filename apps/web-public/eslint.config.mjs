// Public website flat config. Layers Next.js rules on top of the shared root
// config via FlatCompat (eslint-config-next is still eslintrc-format).

import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rootConfig from '../../eslint.config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

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
  ...compat.extends('next/core-web-vitals'),
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
