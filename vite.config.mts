import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Populate process.env so existing server code that reads process.env keeps working in SvelteKit dev.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  // The SvelteKit Better Auth adapter expects PUBLIC_* Convex vars.
  // Mirror existing NEXT_PUBLIC_* values so both naming schemes work.
  if (!process.env.PUBLIC_CONVEX_URL && process.env.NEXT_PUBLIC_CONVEX_URL) {
    process.env.PUBLIC_CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
  }
  if (!process.env.PUBLIC_CONVEX_SITE_URL && process.env.NEXT_PUBLIC_CONVEX_SITE_URL) {
    process.env.PUBLIC_CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  }

  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_', 'PUBLIC_'],
    plugins: [sveltekit()],
  };
});
