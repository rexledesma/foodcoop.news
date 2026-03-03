import type {
  EventbriteEvent,
  FeedPost,
  FoodCoopAnnouncement,
  FoodCoopCooksArticle,
  FoodcoopEvent,
  GazetteArticle,
  ProduceEvent,
} from '@/lib/types';
import type { FeedItem } from '@/lib/discover-feed';
import { getFeedItemKey } from '@/lib/discover-feed';

const COOP_BLUESKY_HANDLE = 'foodcoop.bsky.social';
const SOURCE_FETCH_TIMEOUT_MS = 4500;
const BLUESKY_FEED_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600';
const SLOW_FEED_CACHE_CONTROL = 'public, max-age=300, s-maxage=14400, stale-while-revalidate=86400';
const PRODUCE_EVENT_TIME_EST_OFFSET = '-05:00';

type SourceName =
  | 'gazette'
  | 'bluesky'
  | 'foodcoop'
  | 'foodcoopcooks'
  | 'foodcoopcooks-events'
  | 'wordsprouts-events'
  | 'concert-series-events'
  | 'gm-events'
  | 'produce';

type SourceResponse = {
  lastUpdated?: string;
};

type SourceDefinition = {
  name: SourceName;
  path: string;
  map: (payload: SourceResponse) => FeedItem[];
};

type SourceResult =
  | {
      source: SourceName;
      ok: true;
      items: FeedItem[];
      lastUpdated?: string;
    }
  | {
      source: SourceName;
      ok: false;
      error: string;
    };

type SerializedFeedItem = Omit<FeedItem, 'date'> & { date: string };

const SOURCE_DEFINITIONS: SourceDefinition[] = [
  {
    name: 'gazette',
    path: '/api/gazette',
    map: (payload) => {
      const data = payload as SourceResponse & { articles?: GazetteArticle[] };
      return (data.articles ?? []).map((article) => ({
        type: 'gazette',
        data: article,
        date: new Date(article.pubDate),
      }));
    },
  },
  {
    name: 'bluesky',
    path: '/api/feed/bluesky',
    map: (payload) => {
      const data = payload as SourceResponse & { posts?: FeedPost[] };
      return (data.posts ?? [])
        .filter((post) => {
          if (!post.repostedBy) return true;
          if (post.repostedBy.handle !== COOP_BLUESKY_HANDLE) return false;
          return post.author.handle !== COOP_BLUESKY_HANDLE;
        })
        .map((post) => ({
          type: 'bluesky',
          data: post,
          date: new Date(post.createdAt),
        }));
    },
  },
  {
    name: 'foodcoop',
    path: '/api/foodcoop',
    map: (payload) => {
      const data = payload as SourceResponse & { articles?: FoodCoopAnnouncement[] };
      return (data.articles ?? []).map((article) => ({
        type: 'foodcoop',
        data: article,
        date: new Date(article.pubDate),
      }));
    },
  },
  {
    name: 'foodcoopcooks',
    path: '/api/foodcoopcooks',
    map: (payload) => {
      const data = payload as SourceResponse & { articles?: FoodCoopCooksArticle[] };
      return (data.articles ?? []).map((article) => ({
        type: 'foodcoopcooks',
        data: article,
        date: new Date(article.pubDate),
      }));
    },
  },
  {
    name: 'foodcoopcooks-events',
    path: '/api/foodcoopcooks/events',
    map: (payload) => {
      const data = payload as SourceResponse & { events?: EventbriteEvent[] };
      return (data.events ?? []).map((event) => ({
        type: 'foodcoopcooks-events',
        data: event,
        date: new Date(event.startUtc),
      }));
    },
  },
  {
    name: 'wordsprouts-events',
    path: '/api/wordsprouts/events',
    map: (payload) => {
      const data = payload as SourceResponse & { events?: EventbriteEvent[] };
      return (data.events ?? []).map((event) => ({
        type: 'wordsprouts-events',
        data: event,
        date: new Date(event.startUtc),
      }));
    },
  },
  {
    name: 'concert-series-events',
    path: '/api/concert-series/events',
    map: (payload) => {
      const data = payload as SourceResponse & { events?: EventbriteEvent[] };
      return (data.events ?? []).map((event) => ({
        type: 'concert-series-events',
        data: event,
        date: new Date(event.startUtc),
      }));
    },
  },
  {
    name: 'gm-events',
    path: '/api/foodcoop/gm-events',
    map: (payload) => {
      const data = payload as SourceResponse & { events?: FoodcoopEvent[] };
      return (data.events ?? []).map((event) => ({
        type: 'gm-events',
        data: event,
        date: new Date(event.startUtc),
      }));
    },
  },
  {
    name: 'produce',
    path: '/api/produce/updates',
    map: (payload) => {
      const data = payload as SourceResponse & { events?: ProduceEvent[] };
      return (data.events ?? []).map((event) => ({
        type: 'produce',
        data: event,
        date: new Date(`${event.date}T07:00:00${PRODUCE_EVENT_TIME_EST_OFFSET}`),
      }));
    },
  },
];

function dedupeAndSort(items: FeedItem[]) {
  const byKey = new Map<string, FeedItem>();
  for (const item of items) {
    byKey.set(getFeedItemKey(item), item);
  }

  return Array.from(byKey.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}

function parseSourceFilter(rawSources: string | null): SourceDefinition[] {
  if (!rawSources) {
    return SOURCE_DEFINITIONS;
  }

  const requestedNames = rawSources
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  if (requestedNames.length === 0) {
    return SOURCE_DEFINITIONS;
  }

  const allowed = new Set(requestedNames);
  const filtered = SOURCE_DEFINITIONS.filter((source) => allowed.has(source.name));
  return filtered.length > 0 ? filtered : SOURCE_DEFINITIONS;
}

function parseLimit(rawLimit: string | null): number | null {
  if (!rawLimit) return null;
  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function resolveCacheControl(selectedSources: SourceDefinition[]): string {
  const hasBluesky = selectedSources.some((source) => source.name === 'bluesky');
  return hasBluesky ? BLUESKY_FEED_CACHE_CONTROL : SLOW_FEED_CACHE_CONTROL;
}

async function fetchSource(
  source: SourceDefinition,
  fetchFn: typeof globalThis.fetch,
  timeoutMs = SOURCE_FETCH_TIMEOUT_MS,
): Promise<SourceResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(source.path, { signal: controller.signal });
    if (!response.ok) {
      return {
        source: source.name,
        ok: false,
        error: `HTTP ${response.status}`,
      };
    }

    const payload = (await response.json()) as SourceResponse;

    return {
      source: source.name,
      ok: true,
      items: source.map(payload),
      lastUpdated: payload.lastUpdated,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        source: source.name,
        ok: false,
        error: `Timed out after ${timeoutMs}ms`,
      };
    }

    return {
      source: source.name,
      ok: false,
      error: 'Request failed',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET({ fetch, url }: { fetch: typeof globalThis.fetch; url: URL }) {
  const selectedSources = parseSourceFilter(url.searchParams.get('sources'));
  const cacheControl = resolveCacheControl(selectedSources);
  const limit = parseLimit(url.searchParams.get('limit'));
  const sourceResults = await Promise.all(
    selectedSources.map((source) => fetchSource(source, fetch)),
  );

  const errorsBySource: Partial<Record<SourceName, string>> = {};
  const successfulSources: SourceName[] = [];
  const failedSources: SourceName[] = [];
  const allItems: FeedItem[] = [];
  const lastUpdatedTimestamps: number[] = [];

  for (const result of sourceResults) {
    if (!result.ok) {
      failedSources.push(result.source);
      errorsBySource[result.source] = result.error;
      continue;
    }

    successfulSources.push(result.source);
    allItems.push(...result.items);

    if (result.lastUpdated) {
      const ts = Date.parse(result.lastUpdated);
      if (!Number.isNaN(ts)) lastUpdatedTimestamps.push(ts);
    }
  }

  const dedupedItems = dedupeAndSort(allItems);
  const limitedItems = limit ? dedupedItems.slice(0, limit) : dedupedItems;
  const serializedItems: SerializedFeedItem[] = limitedItems.map((item) => ({
    ...item,
    date: item.date.toISOString(),
  }));

  const maxLastUpdated =
    lastUpdatedTimestamps.length > 0
      ? new Date(Math.max(...lastUpdatedTimestamps)).toISOString()
      : new Date().toISOString();

  const hasAnySuccess = successfulSources.length > 0;

  return Response.json(
    {
      items: serializedItems,
      total: serializedItems.length,
      isPartial: false,
      pendingSources: 0,
      requestedSources: selectedSources.map((source) => source.name),
      successfulSources,
      failedSources,
      errorsBySource,
      lastUpdated: maxLastUpdated,
    },
    {
      status: hasAnySuccess ? 200 : 500,
      headers: {
        'cache-control': cacheControl,
      },
    },
  );
}
