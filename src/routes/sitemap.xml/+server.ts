import { env } from '$env/dynamic/private';
import { encode } from 'html-entities';

const INDEXABLE_PATHS = ['/', '/produce', '/integrations', '/about'] as const;

function toAbsoluteUrl(origin: string, pathname: string): string {
  const normalizedOrigin = origin.replace(/\/+$/, '');
  return `${normalizedOrigin}${pathname}`;
}

function escapeXml(value: string): string {
  return encode(value, { mode: 'specialChars' });
}

export function GET({ url }: { url: URL }): Response {
  const origin = env.SITE_URL || url.origin;
  const urls = INDEXABLE_PATHS.map((pathname): string => toAbsoluteUrl(origin, pathname));
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (entry): string => `  <url>
    <loc>${escapeXml(entry)}</loc>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'cache-control': 'public, max-age=3600',
      'content-type': 'application/xml; charset=utf-8',
    },
  });
}
