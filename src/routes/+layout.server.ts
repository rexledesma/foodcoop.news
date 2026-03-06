import { env } from '$env/dynamic/private';
import type { LayoutServerLoad } from './$types';

const DEFAULT_CANONICAL_ORIGIN = 'https://foodcoop.news';

export const load: LayoutServerLoad = () => {
  let canonicalOrigin = DEFAULT_CANONICAL_ORIGIN;

  try {
    canonicalOrigin = new URL(env.SITE_URL!).origin;
  } catch {
    canonicalOrigin = DEFAULT_CANONICAL_ORIGIN;
  }

  return {
    canonicalOrigin,
  };
};
