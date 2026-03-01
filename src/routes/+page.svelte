<script lang="ts">
  import { onMount } from 'svelte';
  import DiscoverFeed from '@/components/discover/DiscoverFeed.svelte';
  import type { FeedItem } from '@/lib/discover-feed';
  import { getFeedItemKey } from '@/lib/discover-feed';
  import { getCurrentStickyVisibility } from '@/lib/sticky-visibility';
  import type { PageData } from './$types';

  const channel = `discover-${Math.random().toString(36).slice(2)}`;
  let { data }: { data: PageData } = $props();

  type SerializedFeedItem = Omit<FeedItem, 'date'> & { date: string };

  type FeedAggregatorResponse = {
    items?: SerializedFeedItem[];
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
    ['gazette', 'foodcoop', 'gm-events'],
    ['foodcoopcooks-events', 'wordsprouts-events', 'concert-series-events'],
    // Isolated because this request spuriously times out when batched with other sources.
    ['foodcoopcooks'],
  ] as const;

  let loadFeedToken = 0;

  let state = {
    items: [] as FeedItem[],
    loading: true,
    error: '',
    pendingSources: 0,
    showSticky: getCurrentStickyVisibility(),
    favoritesSnapshot: '[]',
    fetchFeeds: () => loadFeeds(),
  };

  const initialState = state;

  function serializeJsonLd(payload: unknown): string {
    return JSON.stringify(payload).replaceAll('<', '\\u003c');
  }

  function buildEventItemList(listName: string, events: DiscoverJsonLdEvent[]) {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: listName,
      numberOfItems: events.length,
      itemListElement: events.map((event, index) => {
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

  function buildNewsItemList(listName: string, newsItems: DiscoverJsonLdNews[]) {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: listName,
      numberOfItems: newsItems.length,
      itemListElement: newsItems.map((newsItem, index) => ({
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

  function readFavoritesSnapshot() {
    const local = localStorage.getItem('produce-favorites');
    const cache = localStorage.getItem('produce-favorites-cache');
    return local ?? cache ?? '[]';
  }

  function writeFavoritesSnapshot(favorites: string[]) {
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

  async function syncFavoritesFromServer() {
    try {
      const response = await fetch('/api/me/produce-favorites', {
        method: 'GET',
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = (await response.json()) as { favorites?: string[] };
      if (!Array.isArray(data.favorites)) return;
      writeFavoritesSnapshot(data.favorites);
    } catch {
      // Ignore sync failures and keep local favorites.
    }
  }

  function dispatchState() {
    window.dispatchEvent(new CustomEvent(`discover-feed-state:update:${channel}`, { detail: state }));
  }

  function sortAndPrune(items: FeedItem[]) {
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
    const fortyFiveDaysAhead = new Date();
    fortyFiveDaysAhead.setDate(fortyFiveDaysAhead.getDate() + 45);

    return [...items]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .filter((item) => item.date >= fortyFiveDaysAgo && item.date <= fortyFiveDaysAhead);
  }

  async function loadFeeds() {
    const token = ++loadFeedToken;

    const parseAndDedupe = (payload: FeedAggregatorResponse): FeedItem[] => {
      const parsedItems = (payload.items ?? [])
        .map(
          (item) =>
            ({
              ...item,
              date: new Date(item.date),
            }) as FeedItem,
        )
        .filter((item) => !Number.isNaN(item.date.getTime()));

      const deduped: FeedItem[] = [];
      const seen = new Set<string>();
      for (const item of parsedItems) {
        const key = getFeedItemKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
      }
      return deduped;
    };

    const isStale = () => token !== loadFeedToken;

    state = {
      ...state,
      loading: true,
      error: '',
      pendingSources: FEED_SOURCE_GROUPS.length,
      items: [],
    };
    dispatchState();

    let hasAnySuccess = false;
    const mergedItems = new Map<string, FeedItem>();
    let pendingGroups: number = FEED_SOURCE_GROUPS.length;

    const groupRequests = FEED_SOURCE_GROUPS.map(async (group) => {
      const params = new URLSearchParams();
      params.set('sources', group.join(','));

      try {
        const response = await fetch(`/api/feed?${params.toString()}`);
        const payload = (await response.json().catch(() => ({}))) as FeedAggregatorResponse;
        const items = parseAndDedupe(payload);
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

  onMount(() => {
    const stickyVisibilityHandler = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      state = { ...state, showSticky: Boolean(event.detail) };
      dispatchState();
    };

    const syncFavorites = () => {
      state = { ...state, favoritesSnapshot: readFavoritesSnapshot() };
      dispatchState();
    };

    state = { ...state, favoritesSnapshot: readFavoritesSnapshot() };
    dispatchState();
    void syncFavoritesFromServer();
    void loadFeeds();

    window.addEventListener('sticky-visibility', stickyVisibilityHandler as EventListener);
    window.addEventListener('produce-favorites', syncFavorites);
    window.addEventListener('produce-favorites-cache', syncFavorites);
    window.addEventListener('storage', syncFavorites);

    return () => {
      window.removeEventListener('sticky-visibility', stickyVisibilityHandler as EventListener);
      window.removeEventListener('produce-favorites', syncFavorites);
      window.removeEventListener('produce-favorites-cache', syncFavorites);
      window.removeEventListener('storage', syncFavorites);
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
