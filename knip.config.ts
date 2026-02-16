const config = {
  ignoreFiles: [
    '.svelte-kit/**',
    'static/sw.js',
    'src/lib/produce-metadata-cache.ts',
    'src/routes/api/**',
  ],
  ignoreIssues: {
    'src/styles/globals.css': ['unresolved'],
    'src/lib/auth.ts': ['exports'],
  },
};

export default config;
