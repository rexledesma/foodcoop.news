import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    semi: true,
    singleQuote: true,
    trailingComma: 'all',
    printWidth: 100,
    tabWidth: 2,
    sortImports: {
      groups: [
        ['builtin', 'external', 'subpath'],
        ['internal', 'parent', 'sibling', 'index'],
        'style',
        'unknown',
      ],
    },
    experimentalTailwindcss: {},
    experimentalSortPackageJson: false,
    ignorePatterns: [
      'node_modules',
      'out',
      'build',
      'dist',
      '.turbo',
      'convex/_generated',
      'pnpm-lock.yaml',
    ],
  },
  lint: {
    plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'import', 'jsx-a11y'],
    ignorePatterns: ['out/**', 'build/**', 'convex/_generated/**'],
    rules: {
      curly: 'error',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          destructuredArrayIgnorePattern: '^_$',
        },
      ],
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
        },
      ],
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  envPrefix: ['VITE_', 'PUBLIC_'],
  plugins: [tailwindcss(), sveltekit()],
});
