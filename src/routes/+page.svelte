<script lang="ts">
  import { onMount } from 'svelte';
  import DiscoverFeed from '@/components/discover/DiscoverFeed.svelte';
  import type { FeedItem } from '@/lib/discover-feed';
  import { getFeedItemKey } from '@/lib/discover-feed';
  import { getCurrentStickyVisibility } from '@/lib/sticky-visibility';
  import type { PageData } from './$types';

  const channel = `discover-${Math.random().toString(36).slice(2)}`;
  const { data }: { data: PageData } = $props();

  type SerializedFeedApiItem = {
    type: string;
    date: string;
    data?: unknown;
  };

  type FeedAggregatorResponse = {
    items?: SerializedFeedApiItem[];
    successfulSources?: string[];
    failedSources?: string[];
    isPartial?: boolean;
    pendingSources?: number;
  };
  type DiscoverJsonLdNews = PageData['latestNews'][number];
  type DiscoverJsonLdEvent = PageData['upcomingEvents'][number];

  const FEED_SOURCE_GROUPS = [
    ['bluesky'],
    ['produce'],
    ['gazette', 'foodcoop', 'gm-events', 'foodcoop-orientation-events'],
    ['foodcoopcooks-events', 'wordsprouts-events', 'concert-series-events'],
    // Isolated because this request spuriously times out when batched with other sources.
    ['foodcoopcooks'],
  ] as const;

  let loadFeedToken = 0;

  function serializeJsonLd(payload: unknown): string {
    return JSON.stringify(payload).replaceAll('<', '\\u003c');
  }

  function buildEventItemList(listName: string, events: DiscoverJsonLdEvent[]) : { '@context': string; '@type': string; name: string; numberOfItems: number; itemListElement: { '@type': string; position: number; item: { location?: { address?: string | undefined; name?: string | undefined; '@type': string; } | undefined; description?: string | undefined; '@type': string; name: string; startDate: string; url: string; }; }[]; } {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: listName,
      numberOfItems: events.length,
      itemListElement: events.map((event, index) : { '@type': string; position: number; item: { location?: { address?: string | undefined; name?: string | undefined; '@type': string; } | undefined; description?: string | undefined; '@type': string; name: string; startDate: string; url: string; }; } => {
        const location =
          event.venueName || event.venueAddress
            ? {
                '@type': 'Place',
                ...(event.venueName ? { name: event.venueName } : {}),
                ...(event.venueAddress ? { address: event.venueAddress } : {}),
              }
            : undefined;

        return {
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'Event',
            name: event.title,
            startDate: event.startUtc,
            url: event.url,
            ...(event.description ? { description: event.description } : {}),
            ...(location ? { location } : {}),
          },
        };
      }),
    };
  }

  function buildNewsItemList(listName: string, newsItems: DiscoverJsonLdNews[]) : { '@context': string; '@type': string; name: string; numberOfItems: number; itemListElement: { '@type': string; position: number; item: { description?: string | undefined; '@type': string; headline: string; datePublished: string; url: string; }; }[]; } {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: listName,
      numberOfItems: newsItems.length,
      itemListElement: newsItems.map((newsItem, index) : { '@type': string; position: number; item: { description?: string | undefined; '@type': string; headline: string; datePublished: string; url: string; }; } => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'NewsArticle',
          headline: newsItem.title,
          datePublished: newsItem.publishedAt,
          url: newsItem.url,
          ...(newsItem.description ? { description: newsItem.description } : {}),
        },
      })),
    };
  }

  function readFavoritesSnapshot() : string {
    const local = localStorage.getItem('produce-favorites');
    const cache = localStorage.getItem('produce-favorites-cache');
    return local ?? cache ?? '[]';
  }

  function readShiftFavoritesSnapshot() : string {
    const local = localStorage.getItem('shift-favorites');
    const cache = localStorage.getItem('shift-favorites-cache');
    return local ?? cache ?? '[]';
  }

  function writeFavoritesSnapshot(favorites: string[]) : void {
    try {
      const snapshot = JSON.stringify(favorites);
      localStorage.setItem('produce-favorites', snapshot);
      localStorage.setItem('produce-favorites-cache', snapshot);
      state = { ...state, favoritesSnapshot: snapshot };
      dispatchState();
      window.dispatchEvent(new Event('produce-favorites'));
      window.dispatchEvent(new Event('produce-favorites-cache'));
    } catch {
      // Ignore local storage errors.
    }
  }

  function writeShiftFavoritesSnapshot(jobFilters: string[]) : void {
    try {
      const snapshot = JSON.stringify(jobFilters);
      localStorage.setItem('shift-favorites', snapshot);
      localStorage.setItem('shift-favorites-cache', snapshot);
      state = { ...state, shiftFavoritesSnapshot: snapshot };
      dispatchState();
      window.dispatchEvent(new Event('shift-favorites'));
      window.dispatchEvent(new Event('shift-favorites-cache'));
    } catch {
      // Ignore local storage errors.
    }
  }

  async function syncFavoritesFromServer() : Promise<void> {
    try {
      const response = await fetch('/api/me/produce-favorites', {
        method: 'GET',
        cache: 'no-store',
      });
      if (!response.ok) {return;}
      const data = (await response.json()) as { favorites?: string[] };
      if (!Array.isArray(data.favorites)) {return;}
      writeFavoritesSnapshot(data.favorites);
    } catch {
      // Ignore sync failures and keep local favorites.
    }
  }

  async function syncShiftFavoritesFromServer() : Promise<void> {
    try {
      const response = await fetch('/api/me/profile', {
        method: 'GET',
        cache: 'no-store',
      });
      if (!response.ok) {
        if (response.status === 401) {
          writeShiftFavoritesSnapshot([]);
        }
        return;
      }
      const data = (await response.json()) as {
        profile?: { jobFilters?: string[] } | null;
      };
      const filters = Array.isArray(data.profile?.jobFilters) ? data.profile.jobFilters : [];
      writeShiftFavoritesSnapshot(filters);
    } catch {
      // Ignore sync failures and keep local shift favorites.
    }
  }

  function dispatchState() : void {
    window.dispatchEvent(new CustomEvent(`discover-feed-state:update:${channel}`, { detail: state }));
  }

  function sortAndPrune(items: FeedItem[]) : FeedItem[] {
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
    const fortyFiveDaysAhead = new Date();
    fortyFiveDaysAhead.setDate(fortyFiveDaysAhead.getDate() + 45);

    return [...items]
      .sort((a, b) : number => b.date.getTime() - a.date.getTime())
      .filter((item) : boolean => item.date >= fortyFiveDaysAgo && item.date <= fortyFiveDaysAhead);
  }

  function parseAndDedupeItems(payload: Pick<FeedAggregatorResponse, 'items'>): FeedItem[] {
    const parsedItems = (payload.items ?? [])
      .map(
        (item) : FeedItem =>
          ({
            ...item,
            date: new Date(item.date),
          }) as FeedItem,
      )
      .filter((item) : boolean => !Number.isNaN(item.date.getTime()));

    const deduped: FeedItem[] = [];
    const seen = new Set<string>();
    for (const item of parsedItems) {
      const key = getFeedItemKey(item);
      if (seen.has(key)) {continue;}
      seen.add(key);
      deduped.push(item);
    }
    return deduped;
  }

  function readInitialServerFeedState(): {
    items: FeedItem[];
    error: string;
    pendingSources: number;
  } {
    return {
      items: sortAndPrune(parseAndDedupeItems({ items: data.initialItems })),
      error: data.initialFeedError,
      pendingSources: data.initialPendingSources,
    };
  }

  const initialServerFeedState = readInitialServerFeedState();

  async function loadFeeds() : Promise<void> {
    const token = ++loadFeedToken;

    const isStale = () : boolean => token !== loadFeedToken;

    state = {
      ...state,
      loading: state.items.length === 0,
      error: '',
      pendingSources: FEED_SOURCE_GROUPS.length,
    };
    dispatchState();

    let hasAnySuccess = state.items.length > 0;
    const mergedItems = new Map<string, FeedItem>(
      state.items.map((item): [string, FeedItem] => [getFeedItemKey(item), item]),
    );
    let pendingGroups: number = FEED_SOURCE_GROUPS.length;

    const groupRequests = FEED_SOURCE_GROUPS.map(async (group) : Promise<void> => {
      const params = new URLSearchParams();
      params.set('sources', group.join(','));

      try {
        const response = await fetch(`/api/feed?${params.toString()}`);
        const payload = (await response.json().catch(() : Record<string, never> => ({}))) as FeedAggregatorResponse;
        const items = parseAndDedupeItems(payload);
        const successCount = payload.successfulSources?.length ?? 0;

        if (successCount > 0 || items.length > 0) {
          hasAnySuccess = true;
        }

        for (const item of items) {
          mergedItems.set(getFeedItemKey(item), item);
        }
      } catch {
        // Ignore request failures and continue updating from available groups.
      } finally {
        pendingGroups = Math.max(0, pendingGroups - 1);
        if (!isStale()) {
          const nextItems = sortAndPrune(Array.from(mergedItems.values()));
          state = {
            ...state,
            items: nextItems,
            loading: pendingGroups > 0 && nextItems.length === 0,
            pendingSources: pendingGroups,
            error:
              pendingGroups === 0 && !hasAnySuccess && nextItems.length === 0
                ? 'Failed to load feed'
                : '',
          };
          dispatchState();
        }
      }
    });

    await Promise.allSettled(groupRequests);
  }

  let state = {
    items: initialServerFeedState.items,
    loading: false,
    error: initialServerFeedState.error,
    pendingSources: initialServerFeedState.pendingSources,
    showSticky: getCurrentStickyVisibility(),
    favoritesSnapshot: '[]',
    shiftFavoritesSnapshot: '[]',
    fetchFeeds: () : Promise<void> => loadFeeds(),
  };

  const initialState = state;

  onMount(() : () => void => {
    const stickyVisibilityHandler = (event: Event) : void => {
      if (!(event instanceof CustomEvent)) {return;}
      state = { ...state, showSticky: Boolean(event.detail) };
      dispatchState();
    };

    const syncLocalSnapshots = () : void => {
      state = { ...state, favoritesSnapshot: readFavoritesSnapshot() };
      state = { ...state, shiftFavoritesSnapshot: readShiftFavoritesSnapshot() };
      dispatchState();
    };

    state = { ...state, favoritesSnapshot: readFavoritesSnapshot() };
    state = { ...state, shiftFavoritesSnapshot: readShiftFavoritesSnapshot() };
    dispatchState();
    void syncFavoritesFromServer();
    void syncShiftFavoritesFromServer();
    void loadFeeds();

    window.addEventListener('sticky-visibility', stickyVisibilityHandler as EventListener);
    window.addEventListener('produce-favorites', syncLocalSnapshots);
    window.addEventListener('produce-favorites-cache', syncLocalSnapshots);
    window.addEventListener('shift-favorites', syncLocalSnapshots);
    window.addEventListener('shift-favorites-cache', syncLocalSnapshots);
    window.addEventListener('storage', syncLocalSnapshots);

    return () : void => {
      window.removeEventListener('sticky-visibility', stickyVisibilityHandler as EventListener);
      window.removeEventListener('produce-favorites', syncLocalSnapshots);
      window.removeEventListener('produce-favorites-cache', syncLocalSnapshots);
      window.removeEventListener('shift-favorites', syncLocalSnapshots);
      window.removeEventListener('shift-favorites-cache', syncLocalSnapshots);
      window.removeEventListener('storage', syncLocalSnapshots);
    };
  });

  const latestEventsJsonLd = $derived(
    serializeJsonLd(buildNewsItemList('Latest Coop News', data.latestNews)),
  );
  const upcomingEventsJsonLd = $derived(
    serializeJsonLd(buildEventItemList('Upcoming Coop Events', data.upcomingEvents)),
  );
</script>

<svelte:head>
  <svelte:element this={'script'} type="application/ld+json">{latestEventsJsonLd}</svelte:element>
  <svelte:element this={'script'} type="application/ld+json">
    {upcomingEventsJsonLd}
  </svelte:element>
</svelte:head>

<DiscoverFeed {channel} {initialState} />
