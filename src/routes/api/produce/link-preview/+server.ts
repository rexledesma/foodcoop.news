import { decode } from 'html-entities';

const PREVIEW_BROWSER_MAX_AGE_SECONDS = 300;
const PREVIEW_CDN_S_MAXAGE_SECONDS = 7 * 24 * 60 * 60;
const PREVIEW_STALE_WHILE_REVALIDATE_SECONDS = 30 * 24 * 60 * 60;
const PREVIEW_CACHE_CONTROL = `public, max-age=${PREVIEW_BROWSER_MAX_AGE_SECONDS}, s-maxage=${PREVIEW_CDN_S_MAXAGE_SECONDS}, stale-while-revalidate=${PREVIEW_STALE_WHILE_REVALIDATE_SECONDS}`;
const FETCH_TIMEOUT_MS = 4500;
const MAX_DESCRIPTION_LENGTH = 240;

type LinkPreview = {
  url: string;
  title: string;
  description?: string;
  siteName?: string;
  image?: string;
};

function isAllowedPreviewHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'specialtyproduce.com' || normalized.endsWith('.specialtyproduce.com');
}

function normalizeMetaText(raw: string): string {
  const withoutTags = raw.replace(/<[^>]+>/g, ' ');
  const decoded = decode(withoutTags);
  return decoded.replace(/\s+/g, ' ').trim();
}

function trimDescription(raw: string): string {
  if (raw.length <= MAX_DESCRIPTION_LENGTH) return raw;
  return `${raw.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}...`;
}

function findMetaContent(html: string, key: string, value: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const directPattern = new RegExp(
    `<meta[^>]*${escapedKey}\\s*=\\s*["']${escapedValue}["'][^>]*content\\s*=\\s*["']([^"']+)["'][^>]*>`,
    'i',
  );
  const reversePattern = new RegExp(
    `<meta[^>]*content\\s*=\\s*["']([^"']+)["'][^>]*${escapedKey}\\s*=\\s*["']${escapedValue}["'][^>]*>`,
    'i',
  );
  const match = html.match(directPattern) ?? html.match(reversePattern);
  return match ? match[1].trim() : null;
}

function findTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch) return null;
  return normalizeMetaText(titleMatch[1]);
}

function resolveAbsoluteUrl(candidate: string | null, baseUrl: URL): string | undefined {
  if (!candidate) return undefined;
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function extractPreview(targetUrl: URL, html: string): LinkPreview {
  const ogTitle = findMetaContent(html, 'property', 'og:title');
  const twitterTitle = findMetaContent(html, 'name', 'twitter:title');
  const title = ogTitle ?? twitterTitle ?? findTitle(html) ?? targetUrl.hostname;

  const ogDescription = findMetaContent(html, 'property', 'og:description');
  const twitterDescription = findMetaContent(html, 'name', 'twitter:description');
  const rawDescription = ogDescription ?? twitterDescription ?? '';
  const description = rawDescription
    ? trimDescription(normalizeMetaText(rawDescription))
    : undefined;

  const siteName =
    findMetaContent(html, 'property', 'og:site_name') ??
    findMetaContent(html, 'name', 'application-name') ??
    undefined;

  const image =
    resolveAbsoluteUrl(findMetaContent(html, 'property', 'og:image'), targetUrl) ??
    resolveAbsoluteUrl(findMetaContent(html, 'name', 'twitter:image'), targetUrl);

  return {
    url: targetUrl.toString(),
    title: normalizeMetaText(title),
    description,
    siteName: siteName ? normalizeMetaText(siteName) : undefined,
    image,
  };
}

async function fetchPreview(targetUrl: URL): Promise<LinkPreview> {
  const controller = new AbortController();
  const timeoutId = setTimeout((): void => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'user-agent': 'foodcoop.news link preview bot',
      },
    });

    if (!response.ok) {
      throw new Error(`Preview source returned HTTP ${response.status}`);
    }

    const html = await response.text();
    return extractPreview(targetUrl, html);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET({ url }: { url: URL }): Promise<Response> {
  const sourceUrl = url.searchParams.get('url');
  if (!sourceUrl) {
    return Response.json({ error: 'Missing url query parameter' }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(sourceUrl);
  } catch {
    return Response.json({ error: 'Invalid url query parameter' }, { status: 400 });
  }

  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    return Response.json({ error: 'Unsupported url protocol' }, { status: 400 });
  }

  if (!isAllowedPreviewHost(targetUrl.hostname)) {
    return Response.json({ error: 'Preview host is not allowed' }, { status: 400 });
  }

  try {
    const preview = await fetchPreview(targetUrl);
    return Response.json(preview, { headers: { 'cache-control': PREVIEW_CACHE_CONTROL } });
  } catch (error) {
    console.error('Produce link preview API error:', error);
    return Response.json({ error: 'Failed to fetch link preview' }, { status: 502 });
  }
}
