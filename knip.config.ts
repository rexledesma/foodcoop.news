const config = {
  ignoreFiles: ['.svelte-kit/**', 'static/sw.js'],
  ignoreIssues: {
    'src/styles/globals.css': ['unresolved'],
  },
};

export default config;
