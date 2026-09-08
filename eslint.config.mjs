import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

export default defineConfig(
  js.configs.recommended,
  {
    // Type-aware rules need the TypeScript program, so they apply only to the files tsconfig.json includes.
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // Every .mjs here runs in node. `no-undef` from the recommended set is switched off for
    // TypeScript by typescript-eslint, but not for .mjs, so node globals are declared once.
    files: ['**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  {
    files: ['tests/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      // The signed-in and signed-out checks live in the header component; count them as assertions.
      'playwright/expect-expect': [
        'warn',
        { assertFunctionNames: ['expectSignedInAs', 'expectSignedOut'] },
      ],
    },
  },
);
