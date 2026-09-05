import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // 'Professional UI mockups project' is the design handoff -- prototype HTML
  // and its support script, kept in the repo because the comments throughout
  // src reference it as the source of truth for every token and measurement.
  // It is reference material, not application source, and linting it reports
  // problems in a file nobody is going to change.
  globalIgnores(['dist', 'Professional UI mockups project']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // The Playwright specs and their Supabase stub run in Node, not a browser:
    // the stub mints a fake JWT with Buffer, which was being reported as an
    // undefined global because this config only ever declared browser ones.
    files: ['tests/**/*.js', 'playwright.config.js', '*.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // The shadcn/ui primitives export a component alongside its cva variant
    // definition (Button + buttonVariants), which react-refresh flags. That
    // pairing is the library's own convention and splitting it would mean
    // hand-editing every component on every future `shadcn add`. Scoped to
    // components/ui so the rule keeps applying to our own screens.
    files: ['src/components/ui/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
