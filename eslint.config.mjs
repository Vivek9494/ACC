import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

import accTypography from './tools/eslint-plugin-acc-typography/index.mjs';
import {
  INPUT_COMPONENT_GLOBS,
  SUB_CAPTION_ALLOWLIST,
} from './tools/eslint-plugin-acc-typography/allowlist.mjs';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/*.tsbuildinfo',
      // Fixture is linted explicitly in verify scripts, not via `eslint .`
      'tools/eslint-plugin-acc-typography/__fixtures__/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,cjs}'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        exports: 'writable',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // --- ACC mobile typography guardrails (Phases 0–3 complete) ---
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    plugins: {
      'acc-typography': accTypography,
    },
    rules: {
      // Sub-12 is error; only documented allowlist paths may use 8–11px.
      'acc-typography/no-sub-caption-font-size': 'error',
      'acc-typography/prefer-type-scale-token': 'warn',
    },
  },
  {
    // Documented density exceptions — see allowlist.mjs SUB_CAPTION_ALLOWLIST_ENTRIES.
    files: SUB_CAPTION_ALLOWLIST,
    rules: {
      'acc-typography/no-sub-caption-font-size': 'off',
      'acc-typography/prefer-type-scale-token': 'off',
    },
  },
  {
    files: INPUT_COMPONENT_GLOBS,
    plugins: {
      'acc-typography': accTypography,
    },
    rules: {
      'acc-typography/no-small-input-font-size': 'error',
    },
  },
  // Fixture file — lint with: pnpm exec eslint --no-ignore tools/eslint-plugin-acc-typography/__fixtures__/violations.tsx
  {
    files: ['tools/eslint-plugin-acc-typography/__fixtures__/**/*.{ts,tsx}'],
    plugins: {
      'acc-typography': accTypography,
    },
    rules: {
      'acc-typography/no-sub-caption-font-size': 'error',
      'acc-typography/no-small-input-font-size': 'error',
      'acc-typography/prefer-type-scale-token': 'warn',
    },
  },
  prettier,
);
