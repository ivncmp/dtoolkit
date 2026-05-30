import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist', '**/coverage', '**/node_modules', 'packages/codegraph-sdk/**'] },

  {
    extends: [js.configs.recommended, ...tseslint.configs.strict, prettier],
    files: ['packages/*/src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
    plugins: {
      'import-x': importX,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      'import-x/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-duplicates': 'warn',

      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: [
      'packages/*/src/cli/**/*.ts',
      'packages/dbrain/src/dashboard/server.ts',
      'packages/dcontext/src/**/*.ts',
      'packages/dproxy/src/**/*.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
);
