import { decode } from 'html-entities';

import type { FoodCoopCooksArticle } from '@/lib/types';

const FOODCOOP_COOKS_RSS_URL = 'https://foodcoopcooks.org/feed/';
const FOODCOOP_COOKS_YOUTUBE_FEED_URL =
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCwuJ5np4xoZbx9CuGxnaz2w';

// Cache feed data for 5 minutes
let cachedArticles: FoodCoopCooksArticle[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

function extractTextContent(xml: string, tagName: string): string {
  const regex = new RegExp(
    `<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tagName}>|<${tagName}[^>]*>([^<]*)</${tagName}>`,
    'i',
  );
  const match = xml.match(regex);
  if (match) {
    return (match[1] || match[2] || '').trim();
  }
  return '';
}

function extractAttributeValue(xml: string, tagName: string, attributeName: string): string {
  const regex = new RegExp(
    `<${tagName}[^>]*${attributeName}=["']([^"']+)["'][^>]*>|<${tagName}[^>]*>`,
    'i',
  );
  const match = xml.match(regex);
  if (match?.[1]) {
    return match[1];
  }
  return '';
}

function extractAlternateLinkHref(xml: string): string {
  const match =
    xml.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["'][^>]*\/?>/i) ||
    xml.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']alternate["'][^>]*\/?>/i);
  return match?.[1] ?? '';
}

async function fetchFoodCoopCooksWordPressFeed(): Promise<FoodCoopCooksArticle[]> {
  const response = await fetch(FOODCOOP_COOKS_RSS_URL);

  if (!response.ok) {
    throw new Error(`Food Coop Cooks RSS error: ${response.status}`);
  }

  const xml = await response.text();

  // Parse items from RSS XML
  interface ParsedItem {
    title: string;
    description?: string;
    link: string;
    pubDate: string;
    id: string;
  }

  const parsedItems: ParsedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null = null;

  while (true) {
    match = itemRegex.exec(xml);
    if (!match) {
      break;
    }
    const itemXml = match[1] ?? '';

    const title = decode(extractTextContent(itemXml, 'title'));
    const rawDescription = extractTextContent(itemXml, 'description');
    // Strip HTML tags and decode entities from description
    const description = decode(rawDescription.replace(/<[^>]*>/g, '')).trim();
    const link = extractTextContent(itemXml, 'link');
    const pubDate = extractTextContent(itemXml, 'pubDate');
    const guid = extractTextContent(itemXml, 'guid');

    const postIdMatch = guid.match(/[?&]p=(\d+)/);
    const postId = postIdMatch?.[1];
    const id = postId ?? Buffer.from(link).toString('base64').slice(0, 20);

    parsedItems.push({
      id,
      title,
      description: description || undefined,
      link,
      pubDate,
    });
  }

  return parsedItems.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    link: item.link,
    pubDate: item.pubDate,
  }));
}

async function fetchFoodCoopCooksYouTubeFeed(): Promise<FoodCoopCooksArticle[]> {
  const response = await fetch(FOODCOOP_COOKS_YOUTUBE_FEED_URL);

  if (!response.ok) {
    throw new Error(`Food Coop Cooks YouTube feed error: ${response.status}`);
  }

  const xml = await response.text();
  const items: FoodCoopCooksArticle[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null = null;

  while (true) {
    match = entryRegex.exec(xml);
    if (!match) {
      break;
    }

    const entryXml = match[1] ?? '';
    const videoId = extractTextContent(entryXml, 'yt:videoId');
    const title = decode(extractTextContent(entryXml, 'title'));
    const description = decode(extractTextContent(entryXml, 'media:description')).trim();
    const link = extractAlternateLinkHref(entryXml);
    const pubDate = extractTextContent(entryXml, 'published');
    const image = extractAttributeValue(entryXml, 'media:thumbnail', 'url');

    if (!videoId || !title || !link || !pubDate) {
      continue;
    }

    items.push({
      id: `youtube-${videoId}`,
      title,
      description: description || undefined,
      link,
      pubDate,
      image: image || undefined,
    });
  }

  return items;
}

async function fetchFoodCoopCooksFeed(): Promise<FoodCoopCooksArticle[]> {
  const [wordpressResult, youtubeResult] = await Promise.allSettled([
    fetchFoodCoopCooksWordPressFeed(),
    fetchFoodCoopCooksYouTubeFeed(),
  ]);

  const items: FoodCoopCooksArticle[] = [];

  if (wordpressResult.status === 'fulfilled') {
    items.push(...wordpressResult.value);
  } else {
    console.error('Food Coop Cooks WordPress feed error:', wordpressResult.reason);
  }

  if (youtubeResult.status === 'fulfilled') {
    items.push(...youtubeResult.value);
  } else {
    console.error('Food Coop Cooks YouTube feed error:', youtubeResult.reason);
  }

  if (items.length === 0) {
    throw new Error('No Food Coop Cooks feeds available');
  }

  return items.sort((a, b) => {
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
  });
}

export async function GET() {
  try {
    const now = Date.now();
    if (!cachedArticles || now - cacheTime > CACHE_DURATION) {
      cachedArticles = await fetchFoodCoopCooksFeed();
      cacheTime = now;
    }

    return Response.json({
      articles: cachedArticles,
      total: cachedArticles.length,
      lastUpdated: new Date(cacheTime).toISOString(),
    });
  } catch (error) {
    console.error('Food Coop Cooks API error:', error);
    return Response.json({ error: 'Failed to fetch Food Coop Cooks articles' }, { status: 500 });
  }
}
