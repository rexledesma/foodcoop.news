import type { FeedItem } from '@/lib/discover-feed';
import { getFeedItemKey } from '@/lib/discover-feed';
import type {
  EventbriteEvent,
  FeedPost,
  FoodCoopAnnouncement,
  FoodCoopCooksArticle,
  FoodcoopEvent,
  GazetteArticle,
  GazetteDeadlineEvent,
  ProduceEvent,
} from '@/lib/types';

const COOP_BLUESKY_HANDLE = 'foodcoop.bsky.social';
const SOURCE_FETCH_TIMEOUT_MS = 4500;
const BLUESKY_FEED_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600';
const SLOW_FEED_CACHE_CONTROL = 'public, max-age=300, s-maxage=14400, stale-while-revalidate=86400';
const PRODUCE_EVENT_TIME_EST_OFFSET = '-05:00';
const GAZETTE_ISSUE_START_UTC = Date.UTC(2025, 11, 30, 12, 0, 0);
const GAZETTE_ISSUE_INTERVAL_DAYS = 21;
const GAZETTE_ARTICLE_DUE_DAYS_BEFORE = 22;
const GAZETTE_LETTERS_DUE_DAYS_BEFORE = 18;
const GAZETTE_DEADLINE_LOOKAHEAD_MONTHS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

type SourceName =
  | 'gazette'
  | 'bluesky'
  | 'foodcoop'
  | 'gazette-events'
  | 'foodcoop-orientation-events'
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

function toIsoDate(utcTimestamp: number): string {
  return new Date(utcTimestamp).toISOString().slice(0, 10);
}

function formatIssueLabel(issueDate: string): string {
  const date = new Date(`${issueDate}T12:00:00Z`);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDueDateLabel(dueDate: string): string {
  const date = new Date(`${dueDate}T12:00:00Z`);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function createGazetteDeadlineEvents(now = new Date()): GazetteDeadlineEvent[] {
  const nextSixMonths = new Date(now);
  nextSixMonths.setMonth(nextSixMonths.getMonth() + GAZETTE_DEADLINE_LOOKAHEAD_MONTHS);

  const nowTime = now.getTime();
  const lookaheadTime = nextSixMonths.getTime();
  const events: GazetteDeadlineEvent[] = [];

  let issueDateUtc = GAZETTE_ISSUE_START_UTC;
  if (issueDateUtc < nowTime) {
    const elapsedDays = (nowTime - issueDateUtc) / DAY_MS;
    const cyclesElapsed = Math.floor(elapsedDays / GAZETTE_ISSUE_INTERVAL_DAYS);
    issueDateUtc += cyclesElapsed * GAZETTE_ISSUE_INTERVAL_DAYS * DAY_MS;
  }

  while (issueDateUtc <= lookaheadTime + GAZETTE_ARTICLE_DUE_DAYS_BEFORE * DAY_MS) {
    const issueDate = toIsoDate(issueDateUtc);
    const articleDueUtc = issueDateUtc - GAZETTE_ARTICLE_DUE_DAYS_BEFORE * DAY_MS;
    const letterDueUtc = issueDateUtc - GAZETTE_LETTERS_DUE_DAYS_BEFORE * DAY_MS;

    if (articleDueUtc >= nowTime && articleDueUtc <= lookaheadTime) {
      const dueDate = toIsoDate(articleDueUtc);
      events.push({
        id: `${issueDate}-article`,
        title: `Member-Submitted Article Deadline`,
        description: `For the ${formatIssueLabel(issueDate)} issue, member article submissions are due on ${formatDueDateLabel(dueDate)}.`,
        issueDate,
        dueDate,
      });
    }

    if (letterDueUtc >= nowTime && letterDueUtc <= lookaheadTime) {
      const dueDate = toIsoDate(letterDueUtc);
      events.push({
        id: `${issueDate}-letter`,
        title: `Letters to the Editor Deadline`,
        description: `For the ${formatIssueLabel(issueDate)} issue, letters to the editor are due on ${formatDueDateLabel(dueDate)}.`,
        issueDate,
        dueDate,
      });
    }

    issueDateUtc += GAZETTE_ISSUE_INTERVAL_DAYS * DAY_MS;
  }

  return events.sort((a, b): number => a.dueDate.localeCompare(b.dueDate)).slice(0, 2);
}

const SOURCE_DEFINITIONS: SourceDefinition[] = [
  {
    name: 'gazette',
    path: '/api/gazette',
    map: (payload): FeedItem[] => {
      const data = payload as SourceResponse & { articles?: GazetteArticle[] };
      const articles: FeedItem[] = (data.articles ?? []).map(
        (article): { type: 'gazette'; data: GazetteArticle; date: Date } => ({
          type: 'gazette',
          data: article,
          date: new Date(article.pubDate),
        }),
      );

      const deadlines: FeedItem[] = createGazetteDeadlineEvents().map(
        (deadline): { type: 'gazette-deadline'; data: GazetteDeadlineEvent; date: Date } => ({
          type: 'gazette-deadline',
          data: deadline,
          date: new Date(`${deadline.dueDate}T12:00:00Z`),
        }),
      );

      return [...articles, ...deadlines];
    },
  },
  {
    name: 'bluesky',
    path: '/api/feed/bluesky',
    map: (payload): { type: 'bluesky'; data: FeedPost; date: Date }[] => {
      const data = payload as SourceResponse & { posts?: FeedPost[] };
      return (data.posts ?? [])
        .filter((post): boolean => {
          if (!post.repostedBy) {
            return true;
          }
          if (post.repostedBy.handle !== COOP_BLUESKY_HANDLE) {
            return false;
          }
          return post.author.handle !== COOP_BLUESKY_HANDLE;
        })
        .map((post): { type: 'bluesky'; data: FeedPost; date: Date } => ({
          type: 'bluesky',
          data: post,
          date: new Date(post.createdAt),
        }));
    },
  },
  {
    name: 'foodcoop',
    path: '/api/foodcoop',
    map: (payload): { type: 'foodcoop'; data: FoodCoopAnnouncement; date: Date }[] => {
      const data = payload as SourceResponse & { articles?: FoodCoopAnnouncement[] };
      return (data.articles ?? []).map(
        (article): { type: 'foodcoop'; data: FoodCoopAnnouncement; date: Date } => ({
          type: 'foodcoop',
          data: article,
          date: new Date(article.pubDate),
        }),
      );
    },
  },
  {
    name: 'gazette-events',
    path: '/api/gazette/events',
    map: (payload): { type: 'gazette-events'; data: FoodcoopEvent; date: Date }[] => {
      const data = payload as SourceResponse & { events?: FoodcoopEvent[] };
      return (data.events ?? []).map(
        (event): { type: 'gazette-events'; data: FoodcoopEvent; date: Date } => ({
          type: 'gazette-events',
          data: event,
          date: new Date(event.startUtc),
        }),
      );
    },
  },
  {
    name: 'foodcoop-orientation-events',
    path: '/api/foodcoop/orientation-events',
    map: (payload): { type: 'foodcoop-orientation-events'; data: FoodcoopEvent; date: Date }[] => {
      const data = payload as SourceResponse & { events?: FoodcoopEvent[] };
      return (data.events ?? []).map(
        (event): { type: 'foodcoop-orientation-events'; data: FoodcoopEvent; date: Date } => ({
          type: 'foodcoop-orientation-events',
          data: event,
          date: new Date(event.startUtc),
        }),
      );
    },
  },
  {
    name: 'foodcoopcooks',
    path: '/api/foodcoopcooks',
    map: (payload): { type: 'foodcoopcooks'; data: FoodCoopCooksArticle; date: Date }[] => {
      const data = payload as SourceResponse & { articles?: FoodCoopCooksArticle[] };
      return (data.articles ?? []).map(
        (article): { type: 'foodcoopcooks'; data: FoodCoopCooksArticle; date: Date } => ({
          type: 'foodcoopcooks',
          data: article,
          date: new Date(article.pubDate),
        }),
      );
    },
  },
  {
    name: 'foodcoopcooks-events',
    path: '/api/foodcoopcooks/events',
    map: (payload): { type: 'foodcoopcooks-events'; data: EventbriteEvent; date: Date }[] => {
      const data = payload as SourceResponse & { events?: EventbriteEvent[] };
      return (data.events ?? []).map(
        (event): { type: 'foodcoopcooks-events'; data: EventbriteEvent; date: Date } => ({
          type: 'foodcoopcooks-events',
          data: event,
          date: new Date(event.startUtc),
        }),
      );
    },
  },
  {
    name: 'wordsprouts-events',
    path: '/api/wordsprouts/events',
    map: (payload): { type: 'wordsprouts-events'; data: EventbriteEvent; date: Date }[] => {
      const data = payload as SourceResponse & { events?: EventbriteEvent[] };
      return (data.events ?? []).map(
        (event): { type: 'wordsprouts-events'; data: EventbriteEvent; date: Date } => ({
          type: 'wordsprouts-events',
          data: event,
          date: new Date(event.startUtc),
        }),
      );
    },
  },
  {
    name: 'concert-series-events',
    path: '/api/concert-series/events',
    map: (payload): { type: 'concert-series-events'; data: EventbriteEvent; date: Date }[] => {
      const data = payload as SourceResponse & { events?: EventbriteEvent[] };
      return (data.events ?? []).map(
        (event): { type: 'concert-series-events'; data: EventbriteEvent; date: Date } => ({
          type: 'concert-series-events',
          data: event,
          date: new Date(event.startUtc),
        }),
      );
    },
  },
  {
    name: 'gm-events',
    path: '/api/foodcoop/gm-events',
    map: (payload): { type: 'gm-events'; data: FoodcoopEvent; date: Date }[] => {
      const data = payload as SourceResponse & { events?: FoodcoopEvent[] };
      return (data.events ?? []).map(
        (event): { type: 'gm-events'; data: FoodcoopEvent; date: Date } => ({
          type: 'gm-events',
          data: event,
          date: new Date(event.startUtc),
        }),
      );
    },
  },
  {
    name: 'produce',
    path: '/api/produce/updates',
    map: (payload): { type: 'produce'; data: ProduceEvent; date: Date }[] => {
      const data = payload as SourceResponse & { events?: ProduceEvent[] };
      return (data.events ?? []).map(
        (event): { type: 'produce'; data: ProduceEvent; date: Date } => ({
          type: 'produce',
          data: event,
          date: new Date(`${event.date}T07:00:00${PRODUCE_EVENT_TIME_EST_OFFSET}`),
        }),
      );
    },
  },
];

function dedupeAndSort(items: FeedItem[]): FeedItem[] {
  const byKey = new Map<string, FeedItem>();
  for (const item of items) {
    byKey.set(getFeedItemKey(item), item);
  }

  return Array.from(byKey.values()).sort((a, b): number => b.date.getTime() - a.date.getTime());
}

function parseSourceFilter(rawSources: string | null): SourceDefinition[] {
  if (!rawSources) {
    return SOURCE_DEFINITIONS;
  }

  const requestedNames = rawSources
    .split(',')
    .map((name): string => name.trim())
    .filter(Boolean);

  if (requestedNames.length === 0) {
    return SOURCE_DEFINITIONS;
  }

  const allowed = new Set(requestedNames);
  const filtered = SOURCE_DEFINITIONS.filter((source): boolean => allowed.has(source.name));
  return filtered.length > 0 ? filtered : SOURCE_DEFINITIONS;
}

function parseLimit(rawLimit: string | null): number | null {
  if (!rawLimit) {
    return null;
  }
  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function resolveCacheControl(selectedSources: SourceDefinition[]): string {
  const hasBluesky = selectedSources.some((source): boolean => source.name === 'bluesky');
  return hasBluesky ? BLUESKY_FEED_CACHE_CONTROL : SLOW_FEED_CACHE_CONTROL;
}

async function fetchSource(
  source: SourceDefinition,
  fetchFn: typeof globalThis.fetch,
  timeoutMs = SOURCE_FETCH_TIMEOUT_MS,
): Promise<SourceResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout((): void => controller.abort(), timeoutMs);

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

export async function GET({
  fetch,
  url,
}: {
  fetch: typeof globalThis.fetch;
  url: URL;
}): Promise<Response> {
  const selectedSources = parseSourceFilter(url.searchParams.get('sources'));
  const cacheControl = resolveCacheControl(selectedSources);
  const limit = parseLimit(url.searchParams.get('limit'));
  const sourceResults = await Promise.all(
    selectedSources.map((source): Promise<SourceResult> => fetchSource(source, fetch)),
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
      if (!Number.isNaN(ts)) {
        lastUpdatedTimestamps.push(ts);
      }
    }
  }

  const dedupedItems = dedupeAndSort(allItems);
  const limitedItems = limit ? dedupedItems.slice(0, limit) : dedupedItems;
  const serializedItems: SerializedFeedItem[] = limitedItems.map(
    (
      item,
    ):
      | { date: string; type: 'gazette'; data: GazetteArticle }
      | { date: string; type: 'gazette-deadline'; data: GazetteDeadlineEvent }
      | { date: string; type: 'bluesky'; data: FeedPost }
      | { date: string; type: 'foodcoop'; data: FoodCoopAnnouncement }
      | { date: string; type: 'gazette-events'; data: FoodcoopEvent }
      | { date: string; type: 'foodcoop-orientation-events'; data: FoodcoopEvent }
      | { date: string; type: 'foodcoopcooks'; data: FoodCoopCooksArticle }
      | { date: string; type: 'foodcoopcooks-events'; data: EventbriteEvent }
      | { date: string; type: 'wordsprouts-events'; data: EventbriteEvent }
      | { date: string; type: 'concert-series-events'; data: EventbriteEvent }
      | { date: string; type: 'gm-events'; data: FoodcoopEvent }
      | { date: string; type: 'produce'; data: ProduceEvent } => ({
      ...item,
      date: item.date.toISOString(),
    }),
  );

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
      requestedSources: selectedSources.map((source): SourceName => source.name),
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
