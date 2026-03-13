import { createSvelteKitHandler } from '@mmailaender/convex-better-auth-svelte/sveltekit';

export const { GET, POST } = createSvelteKitHandler({
  convexSiteUrl: process.env.PUBLIC_CONVEX_SITE_URL,
});
