import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Populate process.env so existing server code that reads process.env keeps working in SvelteKit dev.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [sveltekit()],
  };
});
