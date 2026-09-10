import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import js from '@eslint/js';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // What git ignores, the linter ignores, so the list is written once and only for git. The
  // local exclude file is read as well: a working copy may carry directories the repository
  // does not. Missing files are dropped first - includeIgnoreFile throws on a missing path.
  ['.gitignore', '.git/info/exclude']
    .map((name) => ({ name, path: resolve(import.meta.dirname, name) }))
    .filter(({ path }) => existsSync(path))
    .map(({ name, path }) => includeIgnoreFile(path, name)),
  js.configs.recommended,
  {
    // Every .mjs file here runs in Node, not in the page. nodeBuiltin rather than node:
    // a module has neither require nor __dirname.
    files: ['**/*.mjs'],
    languageOptions: { globals: globals.nodeBuiltin },
  },
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
