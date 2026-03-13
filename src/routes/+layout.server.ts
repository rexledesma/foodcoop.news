import { PUBLIC_SITE_URL } from '$env/static/public';
import type { LayoutServerLoad } from './$types';

const DEFAULT_CANONICAL_ORIGIN = 'https://foodcoop.news';

export const load: LayoutServerLoad = () => {
  let canonicalOrigin = DEFAULT_CANONICAL_ORIGIN;

  try {
    canonicalOrigin = new URL(PUBLIC_SITE_URL).origin;
  } catch {
    canonicalOrigin = DEFAULT_CANONICAL_ORIGIN;
  }

  return {
    canonicalOrigin,
  };
};
