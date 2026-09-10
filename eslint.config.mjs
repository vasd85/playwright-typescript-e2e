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
  {
    // Only here: the oracle of the setup project is the exception registerVerified throws, and
    // naming it an assertion for every spec would let a test without an oracle through.
    files: ['tests/setup/**/*.ts'],
    rules: {
      'playwright/expect-expect': ['warn', { assertFunctionNames: ['registerVerified'] }],
    },
  },
);
