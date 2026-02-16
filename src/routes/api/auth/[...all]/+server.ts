import { createSvelteKitHandler } from '@mmailaender/convex-better-auth-svelte/sveltekit';

export const { GET, POST } = createSvelteKitHandler({
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
});
