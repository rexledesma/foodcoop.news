import { PUBLIC_SITE_URL } from '$env/static/public';

function toAbsoluteUrl(origin: string, pathname: string): string {
  const normalizedOrigin = origin.replace(/\/+$/, '');
  return `${normalizedOrigin}${pathname}`;
}

export function GET({ url }: { url: URL }): Response {
  const origin = PUBLIC_SITE_URL || url.origin;
  const sitemapUrl = toAbsoluteUrl(origin, '/sitemap.xml');
  const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /login
Disallow: /signup

Sitemap: ${sitemapUrl}
`;

  return new Response(body, {
    headers: {
      'cache-control': 'public, max-age=3600',
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}
