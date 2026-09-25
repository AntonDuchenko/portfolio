// Lint: correctness first (typescript-eslint with type information), then a light
// style layer (@stylistic) that pins the conventions the code already follows —
// single quotes, semicolons, 2-space indent. No Prettier: it would rewrite the
// deliberately compact scene code for no behavioural gain.
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'public/', 'assets-src/', 'docs/', 'test-results/', 'playwright-report/', '**/node_modules/', 'scripts/voice/.cache/'] },

  js.configs.recommended,

  // app and tests: type-aware rules
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['playwright.config.ts'], defaultProject: 'tests/tsconfig.json' },
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // promises the app starts on purpose (lazy import, fire-and-forget audio) say so with `void`
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // numeric template literals are how CSS values are built here
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // `x || default` on numbers is used where 0 means "not set"
      '@typescript-eslint/prefer-nullish-coalescing': 'off'
    }
  },

  // node-side scripts (asset and voice builds)
  {
    files: ['scripts/**/*.mjs', '*.js'],
    languageOptions: { globals: globals.node }
  },

  // style: what the code already does, enforced
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/indent': ['error', 2, { SwitchCase: 1, ignoredNodes: ['TemplateLiteral *'] }],
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/eol-last': 'error',
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': ['error', { max: 2, maxEOF: 0 }],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/arrow-parens': ['error', 'as-needed'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error'
    }
  }
);
