import adapter from '@sveltejs/adapter-vercel';
import type { Config } from '@sveltejs/kit';

const config: Config = {
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
