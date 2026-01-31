import { NextResponse } from 'next/server';
import { decode } from 'html-entities';
import type { FoodCoopAnnouncement } from '@/lib/types';

const FOODCOOP_RSS_URL = 'https://www.foodcoop.com/feed/';

// Cache feed data for 5 minutes
let cachedArticles: FoodCoopAnnouncement[] | null = null;
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
    // Look for twitter:image or og:image meta tag
    const match =
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i) ||
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    if (match) {
      // Decode HTML entities in URL
      return match[1].replace(/&#038;/g, '&').replace(/&amp;/g, '&');
    }
    return undefined;
  } catch {
    return undefined;
  }
}

async function fetchFoodCoopFeed(): Promise<FoodCoopAnnouncement[]> {
  const response = await fetch(FOODCOOP_RSS_URL);

  if (!response.ok) {
    throw new Error(`Food Coop RSS error: ${response.status}`);
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
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = decode(extractTextContent(itemXml, 'title'));
    const rawDescription = extractTextContent(itemXml, 'description');
    // Strip HTML tags and decode entities from description
    const description = decode(rawDescription.replace(/<[^>]*>/g, '')).trim();
    const link = extractTextContent(itemXml, 'link');
    const pubDate = extractTextContent(itemXml, 'pubDate');
    const guid = extractTextContent(itemXml, 'guid');

    // Extract post ID from guid (e.g., "https://www.foodcoop.com/?p=12345")
    const postIdMatch = guid.match(/[?&]p=(\d+)/);
    const id = postIdMatch ? postIdMatch[1] : Buffer.from(link).toString('base64').slice(0, 20);

    parsedItems.push({
      id,
      title,
      description: description || undefined,
      link,
      pubDate,
    });
  }

  // Fetch twitter:image for all articles in parallel
  const images = await Promise.all(parsedItems.map((item) => fetchTwitterImage(item.link)));

  // Combine parsed items with images
  return parsedItems.map((item, index) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    link: item.link,
    pubDate: item.pubDate,
    image: images[index],
  }));
}

export async function GET() {
  try {
    const now = Date.now();
    if (!cachedArticles || now - cacheTime > CACHE_DURATION) {
      cachedArticles = await fetchFoodCoopFeed();
      cacheTime = now;
    }

    return NextResponse.json({
      articles: cachedArticles,
      total: cachedArticles.length,
      lastUpdated: new Date(cacheTime).toISOString(),
    });
  } catch (error) {
    console.error('Food Coop API error:', error);
    return NextResponse.json({ error: 'Failed to fetch Food Coop articles' }, { status: 500 });
  }
}
