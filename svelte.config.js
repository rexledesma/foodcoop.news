import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    alias: {
      '@': './src',
      '@convex': './convex',
    },
  },
};

export default config;
