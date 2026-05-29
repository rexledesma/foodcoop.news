import type { PageServerLoad } from './$types';
import type { FoodcoopEvent } from '@/lib/types';

const EVENT_ITEM_TYPES = new Set(['gazette-events', 'foodcoop-orientation-events']);
const NEWS_ITEM_TYPES = new Set(['foodcoop', 'gazette', 'foodcoopcooks', 'produce', 'bluesky']);

type DiscoverEventItem = {
  title: string;
  startUtc: string;
  url: string;
  description?: string;
  venueName?: string;
  venueAddress?: string;
};

type DiscoverNewsItem = {
  title: string;
  publishedAt: string;
  url: string;
  description?: string;
};

type SerializedFeedItem = {
  type: string;
  date: string;
  data?: FoodcoopEvent | Record<string, unknown>;
};

type FeedResponse = {
  items?: SerializedFeedItem[];
  successfulSources?: string[];
  failedSources?: string[];
  isPartial?: boolean;
  pendingSources?: number;
};

function isEventType(value: string): boolean {
  return EVENT_ITEM_TYPES.has(value);
}

function isNewsType(value: string): boolean {
  return NEWS_ITEM_TYPES.has(value);
}

function parseDate(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as Record<string, unknown>;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toDiscoverEvent(item: SerializedFeedItem): DiscoverEventItem | null {
  const data = toRecord(item.data);
  if (!data) {
    return null;
  }

  const title = readOptionalString(data, 'title');
  const url = readOptionalString(data, 'url');
  if (!title || !url) {
    return null;
  }

  const dateFromItem = parseDate(item.date);
  if (!dateFromItem) {
    return null;
  }

  const startUtc = readOptionalString(data, 'startUtc')
    ? (readOptionalString(data, 'startUtc') as string)
    : item.date;

  return {
    title,
    startUtc,
    url,
    description: readOptionalString(data, 'description'),
    venueName: readOptionalString(data, 'venueName'),
    venueAddress: readOptionalString(data, 'venueAddress'),
  };
}

function toDiscoverNews(item: SerializedFeedItem): DiscoverNewsItem | null {
  const data = toRecord(item.data);
  if (!data) {
    return null;
  }

  const publishedAt = parseDate(item.date)?.toISOString();
  if (!publishedAt) {
    return null;
  }

  if (item.type === 'produce') {
    const date = readOptionalString(data, 'date') ?? readOptionalString(data, 'id');
    if (!date) {
      return null;
    }

    const newArrivalsCount = Array.isArray(data['newArrivals']) ? data['newArrivals'].length : 0;
    const outOfStockCount = Array.isArray(data['outOfStock']) ? data['outOfStock'].length : 0;

    return {
      title: `Produce update: ${newArrivalsCount} new arrivals, ${outOfStockCount} out of stock`,
      publishedAt,
      url: `/produce?date=${encodeURIComponent(date)}`,
      description: `Produce update for ${date}.`,
    };
  }

  if (item.type === 'bluesky') {
    const postText = readOptionalString(data, 'text') ?? '';
    const uri = readOptionalString(data, 'uri');
    if (!uri) {
      return null;
    }

    const parts = uri.replace('at://', '').split('/');
    const handle = parts[0];
    const postId = parts[parts.length - 1];
    if (!handle || !postId) {
      return null;
    }

    return {
      title: postText.split('\n')[0]?.trim() || 'Bluesky update',
      publishedAt,
      url: `https://bsky.app/profile/${handle}/post/${postId}`,
      description: postText || undefined,
    };
  }

  const title = readOptionalString(data, 'title') ?? '';
  if (!title) {
    return null;
  }

  const url =
    typeof data['link'] === 'string'
      ? data['link']
      : typeof data['url'] === 'string'
        ? data['url']
        : '';
  if (!url) {
    return null;
  }

  const description =
    typeof data['description'] === 'string' && data['description'].length > 0
      ? data['description']
      : undefined;

  return {
    title,
    publishedAt,
    url,
    description,
  };
}

function sortByDateAsc(a: DiscoverEventItem, b: DiscoverEventItem): number {
  return new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime();
}

function sortNewsByDateDesc(a: DiscoverNewsItem, b: DiscoverNewsItem): number {
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}

export const load: PageServerLoad = async ({ fetch, url }) => {
  try {
    const feedResponse = await fetch('/api/feed');
    if (!feedResponse.ok) {
      return {
        initialItems: [] as SerializedFeedItem[],
        initialPendingSources: 0,
        initialFeedError: 'Failed to load feed',
        latestNews: [] as DiscoverNewsItem[],
        upcomingEvents: [] as DiscoverEventItem[],
      };
    }

    const feedPayload = (await feedResponse.json()) as FeedResponse;
    const now = new Date();
    const fortyFiveDaysAgo = new Date(now);
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
    const fortyFiveDaysAhead = new Date(now);
    fortyFiveDaysAhead.setDate(fortyFiveDaysAhead.getDate() + 45);
    const initialItems = (feedPayload.items ?? [])
      .filter((item) => {
        const date = parseDate(item.date);
        return Boolean(date && date >= fortyFiveDaysAgo && date <= fortyFiveDaysAhead);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const eventItems = initialItems
      .filter((item) => isEventType(item.type))
      .map(toDiscoverEvent)
      .filter((item): item is DiscoverEventItem => Boolean(item))
      .filter((item) => new Date(item.startUtc) >= fortyFiveDaysAgo);

    const latestNews = initialItems
      .filter((item) => isNewsType(item.type))
      .map(toDiscoverNews)
      .filter((item): item is DiscoverNewsItem => Boolean(item))
      .map((item) => ({
        ...item,
        url: item.url.startsWith('http') ? item.url : new URL(item.url, url.origin).toString(),
      }))
      .sort(sortNewsByDateDesc)
      .slice(0, 10);

    const upcomingEvents = [...eventItems]
      .filter((item) => new Date(item.startUtc) >= now)
      .sort(sortByDateAsc)
      .slice(0, 10);

    return {
      initialItems,
      initialPendingSources: feedPayload.pendingSources ?? 0,
      initialFeedError:
        (feedPayload.items ?? []).length === 0 &&
        (feedPayload.successfulSources?.length ?? 0) === 0 &&
        (feedPayload.failedSources?.length ?? 0) > 0
          ? 'Failed to load feed'
          : '',
      latestNews,
      upcomingEvents,
    };
  } catch {
    return {
      initialItems: [] as SerializedFeedItem[],
      initialPendingSources: 0,
      initialFeedError: 'Failed to load feed',
      latestNews: [] as DiscoverNewsItem[],
      upcomingEvents: [] as DiscoverEventItem[],
    };
  }
};
