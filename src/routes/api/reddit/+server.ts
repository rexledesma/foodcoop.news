import { decode } from 'html-entities';

import type { RedditPost } from '@/lib/types';

const REDDIT_URL = 'https://www.reddit.com/r/parkslopefoodcoop.json?limit=25';
const THUMBNAIL_PLACEHOLDERS = new Set(['self', 'default', 'image', 'nsfw', 'spoiler', 'video']);

// Cache feed data for 5 minutes
let cachedPosts: RedditPost[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

async function fetchRedditPosts(): Promise<RedditPost[]> {
  const response = await fetch(REDDIT_URL, {
    headers: { 'User-Agent': 'foodcoop.news/1.0' },
  });

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status}`);
  }

  const json = await response.json();
  const children = json?.data?.children ?? [];

  return children.map((child: Record<string, unknown>): RedditPost => {
    const d = child['data'] as Record<string, unknown>;

    const rawThumbnail = d['thumbnail'];
    const thumbnail =
      typeof rawThumbnail === 'string' && !THUMBNAIL_PLACEHOLDERS.has(rawThumbnail)
        ? rawThumbnail
        : undefined;

    let image: string | undefined;
    const preview = d['preview'] as Record<string, unknown> | undefined;
    if (preview) {
      const images = preview['images'] as Array<Record<string, unknown>> | undefined;
      const source = images?.[0]?.['source'] as Record<string, unknown> | undefined;
      const sourceUrl = source?.['url'] as string | undefined;
      if (sourceUrl) {
        image = decode(sourceUrl);
      }
    }

    return {
      id: d['id'] as string,
      title: decode(d['title'] as string),
      link: d['url'] as string,
      pubDate: new Date((d['created_utc'] as number) * 1000).toISOString(),
      selftext: decode((d['selftext'] as string) || '') || undefined,
      image,
      thumbnail,
      permalink: `https://www.reddit.com${d['permalink'] as string}`,
    };
  });
}

export async function GET() {
  try {
    const now = Date.now();
    if (!cachedPosts || now - cacheTime > CACHE_DURATION) {
      cachedPosts = await fetchRedditPosts();
      cacheTime = now;
    }

    return Response.json({
      posts: cachedPosts,
      total: cachedPosts.length,
      lastUpdated: new Date(cacheTime).toISOString(),
    });
  } catch (error) {
    console.error('Reddit API error:', error);
    return Response.json({ error: 'Failed to fetch Reddit posts' }, { status: 500 });
  }
}
