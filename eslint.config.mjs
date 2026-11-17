// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'qa-news/**', 'data/**', '.claude/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    // Ratchet: existing `any` usage in src is reported as warnings, to be tightened later.
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
    },
  },
  {
    // Tests mock heavily; type-unsafe access is acceptable there.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-empty': 'off',
      'prefer-const': 'warn',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.js'],
    languageOptions: { globals: { module: 'readonly', require: 'readonly', __dirname: 'readonly' } },
  },
  prettier,
);
