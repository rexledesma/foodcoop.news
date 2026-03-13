import { createSvelteKitHandler } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { PUBLIC_CONVEX_SITE_URL } from '$env/static/public';

export const { GET, POST } = createSvelteKitHandler({
  convexSiteUrl: PUBLIC_CONVEX_SITE_URL,
});
