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
