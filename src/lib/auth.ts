import { convexBetterAuthNextJs } from '@convex-dev/better-auth/nextjs';

export const { handler, fetchAuthQuery } = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
});
