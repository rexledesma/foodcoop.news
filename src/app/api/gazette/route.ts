import { NextResponse } from 'next/server';
import type { GazetteArticle } from '@/lib/types';

const GAZETTE_RSS_URL = 'https://linewaitersgazette.com/feed/';

// Cache feed data for 5 minutes
let cachedArticles: GazetteArticle[] | null = null;
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

async function fetchTwitterImage(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;

    const html = await response.text();
    // Look for twitter:image meta tag
    const match =
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);

    if (match) {
      // Decode HTML entities in URL
      return match[1].replace(/&#038;/g, '&').replace(/&amp;/g, '&');
    }
    return undefined;
  } catch {
    return undefined;
  }
}

async function fetchGazetteFeed(): Promise<GazetteArticle[]> {
  const response = await fetch(GAZETTE_RSS_URL);

  if (!response.ok) {
    throw new Error(`Gazette RSS error: ${response.status}`);
  }

  const xml = await response.text();

  // Parse items from RSS XML
  interface ParsedItem {
    title: string;
    link: string;
    pubDate: string;
    id: string;
  }

  const parsedItems: ParsedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTextContent(itemXml, 'title');
    const link = extractTextContent(itemXml, 'link');
    const pubDate = extractTextContent(itemXml, 'pubDate');
    const guid = extractTextContent(itemXml, 'guid');

    // Extract post ID from guid (e.g., "https://linewaitersgazette.com/?p=12345")
    const postIdMatch = guid.match(/[?&]p=(\d+)/);
    const id = postIdMatch ? postIdMatch[1] : Buffer.from(link).toString('base64').slice(0, 20);

    parsedItems.push({
      id,
      title,
      link,
      pubDate,
    });
  }

  // Fetch twitter:image for all articles in parallel
  const images = await Promise.all(parsedItems.map((item) => fetchTwitterImage(item.link)));

  // Combine parsed items with images
  return parsedItems.map((item, index) => ({
    ...item,
    image: images[index],
  }));
}

export async function GET() {
  try {
    const now = Date.now();
    if (!cachedArticles || now - cacheTime > CACHE_DURATION) {
      cachedArticles = await fetchGazetteFeed();
      cacheTime = now;
    }

    return NextResponse.json({
      articles: cachedArticles,
      total: cachedArticles.length,
      lastUpdated: new Date(cacheTime).toISOString(),
    });
  } catch (error) {
    console.error('Gazette API error:', error);
    return NextResponse.json({ error: 'Failed to fetch Gazette articles' }, { status: 500 });
  }
}
