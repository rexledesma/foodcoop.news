import { decode } from 'html-entities';

import type { FoodcoopEvent } from '@/lib/types';

const GAZETTE_EVENTS_RSS_URL = 'https://linewaitersgazette.com/events/feed/';
const TIMEZONE = 'America/New_York';

let cachedEvents: FoodcoopEvent[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

function extractTextContent(xml: string, tagName: string): string {
  const escapedTagName = tagName.replace(':', '\\:');
  const regex = new RegExp(
    `<${escapedTagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${escapedTagName}>|<${escapedTagName}[^>]*>([\\s\\S]*?)</${escapedTagName}>`,
    'i',
  );
  const match = xml.match(regex);
  if (!match) {
    return '';
  }
  return decode(match[1] || match[2] || '').trim();
}

function stripHtml(html: string): string {
  return decode(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim(),
  );
}

function parseEventDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function parseEventId(itemXml: string, link: string): string {
  const postId = extractTextContent(itemXml, 'post-id');
  if (postId) {
    return postId;
  }

  const guid = extractTextContent(itemXml, 'guid');
  const guidPostId = guid.match(/[?&]p=(\d+)/)?.[1];
  if (guidPostId) {
    return guidPostId;
  }

  return Buffer.from(link).toString('base64').slice(0, 20);
}

function resolveAbsoluteUrl(value: string, baseUrl: string): string {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

async function fetchPreviewImage(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return undefined;
    }

    const html = await response.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);

    if (!match?.[1]) {
      return undefined;
    }

    return resolveAbsoluteUrl(decode(match[1]), url);
  } catch {
    return undefined;
  }
}

async function fetchGazetteEventsFeed(): Promise<FoodcoopEvent[]> {
  const response = await fetch(GAZETTE_EVENTS_RSS_URL);

  if (!response.ok) {
    throw new Error(`Gazette events RSS error: ${response.status}`);
  }

  const xml = await response.text();
  const events: FoodcoopEvent[] = [];
  const now = Date.now();
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1] ?? '';
    const title = extractTextContent(itemXml, 'title');
    const url = extractTextContent(itemXml, 'link');
    const startUtc = parseEventDate(extractTextContent(itemXml, 'pubDate'));

    if (!title || !url || !startUtc || new Date(startUtc).getTime() < now) {
      continue;
    }

    const encodedDescription = extractTextContent(itemXml, 'content:encoded');
    const description = stripHtml(encodedDescription || extractTextContent(itemXml, 'description'));

    events.push({
      id: parseEventId(itemXml, url),
      title,
      description: description || undefined,
      url,
      startUtc,
      timezone: TIMEZONE,
    });
  }

  const images = await Promise.all(events.map((event) => fetchPreviewImage(event.url)));

  return events
    .map((event, index): FoodcoopEvent => ({ ...event, image: images[index] }))
    .sort((a, b): number => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());
}

export async function GET() {
  try {
    const now = Date.now();
    if (!cachedEvents || now - cacheTime > CACHE_DURATION) {
      cachedEvents = await fetchGazetteEventsFeed();
      cacheTime = now;
    }

    return Response.json({
      events: cachedEvents,
      total: cachedEvents.length,
      lastUpdated: new Date(cacheTime).toISOString(),
    });
  } catch (error) {
    console.error('Gazette events API error:', error);
    return Response.json({ error: 'Failed to fetch Gazette events' }, { status: 500 });
  }
}
