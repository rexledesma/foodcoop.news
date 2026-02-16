const config = {
  ignoreDependencies: ['svelte-loader'],
  ignoreFiles: [
    '.svelte-kit/**',
    'public/sw.js',
    'src/lib/produce-metadata-cache.ts',
    'src/routes/api/**',
  ],
  ignoreIssues: {
    'src/app/globals.css': ['unresolved'],
    'src/lib/auth.ts': ['exports'],
  },
};

export default config;
