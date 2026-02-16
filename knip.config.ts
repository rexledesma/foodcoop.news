const config = {
  ignoreDependencies: ['svelte-loader'],
  ignoreFiles: ['public/sw.js'],
  ignoreIssues: {
    'src/app/globals.css': ['unresolved'],
  },
};

export default config;
