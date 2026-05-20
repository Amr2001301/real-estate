// Web-admin's flat config. Layers Next.js rules on top of the root config via
// FlatCompat (eslint-config-next is still a legacy/eslintrc-format config).

import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rootConfig from '../../eslint.config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

// Extra globals used as types/namespaces inside .tsx files (DOM types that
// ESLint's no-undef can't see without `@types/dom` declared globally, plus
// React used as a namespace e.g. `React.ReactNode`).
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
  ...compat.extends('next/core-web-vitals'),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: REACT_AND_DOM_GLOBALS },
  },
  {
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
