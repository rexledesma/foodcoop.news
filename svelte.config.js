import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    files: {
      assets: 'public',
    },
    alias: {
      '@': './src',
    },
  },
};

export default config;
