import adapter from '@sveltejs/adapter-vercel';

const config = {
  compilerOptions: {
    runes: true,
  },
  kit: {
    adapter: adapter(),
    alias: {
      '@': './src',
      '@convex': './convex',
    },
  },
};

export default config;
