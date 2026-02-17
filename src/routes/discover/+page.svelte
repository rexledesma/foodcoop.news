<script lang="ts">
  import { onMount } from 'svelte';
  import DiscoverFeed from '@/components/discover/DiscoverFeed.svelte';
  import type { FeedItem } from '@/lib/discover-feed';
  import { getFeedItemKey } from '@/lib/discover-feed';
  import { getCurrentStickyVisibility } from '@/lib/sticky-visibility';

  const channel = `discover-${Math.random().toString(36).slice(2)}`;

  type SerializedFeedItem = Omit<FeedItem, 'date'> & { date: string };

  type FeedAggregatorResponse = {
    items?: SerializedFeedItem[];
    successfulSources?: string[];
    failedSources?: string[];
    isPartial?: boolean;
    pendingSources?: number;
  };

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

    state = {
      ...state,
      loading: true,
      error: '',
      pendingSources: 2,
      items: [],
    };
    dispatchState();

    let hasAnySuccess = false;

    try {
      const firstResponse = await fetch('/api/feed?mode=first');
      const firstPayload = (await firstResponse.json().catch(() => ({}))) as FeedAggregatorResponse;
      const firstSuccessCount = firstPayload.successfulSources?.length ?? 0;
      const firstItems = parseAndDedupe(firstPayload);

      if (firstSuccessCount > 0 || firstItems.length > 0) {
        hasAnySuccess = true;
        state = {
          ...state,
          items: sortAndPrune(firstItems),
          loading: false,
          pendingSources: 1,
          error: '',
        };
        dispatchState();
      }

      const fullResponse = await fetch('/api/feed');
      const fullPayload = (await fullResponse.json().catch(() => ({}))) as FeedAggregatorResponse;
      const fullItems = parseAndDedupe(fullPayload);
      const fullSuccessCount = fullPayload.successfulSources?.length ?? 0;
      const fullHasResponseError = !fullResponse.ok;
      if (fullSuccessCount > 0 || fullItems.length > 0) {
        hasAnySuccess = true;
      }

      state = {
        ...state,
        items: sortAndPrune(fullItems),
        loading: false,
        pendingSources: 0,
        error:
          fullHasResponseError && fullSuccessCount === 0 && fullItems.length === 0 && !hasAnySuccess
            ? 'Failed to load feed'
            : '',
      };
      dispatchState();
    } catch {
      state = {
        ...state,
        items: state.items,
        loading: false,
        pendingSources: 0,
        error: hasAnySuccess || state.items.length > 0 ? '' : 'Failed to load feed',
      };
      dispatchState();
    }
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
</script>

<DiscoverFeed {channel} {initialState} />
