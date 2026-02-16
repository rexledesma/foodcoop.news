<script lang="ts">
  import { onMount } from 'svelte';
  import DiscoverFeed from '@/components/discover/DiscoverFeed.svelte';
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
  import { getCurrentStickyVisibility } from '@/lib/sticky-visibility';

  const channel = `discover-${Math.random().toString(36).slice(2)}`;
  const COOP_BLUESKY_HANDLE = 'foodcoop.bsky.social';

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
    const sources = [
      {
        url: '/api/gazette',
        map: (data: { articles: GazetteArticle[] }) =>
          data.articles.map(
            (article) =>
              ({
                type: 'gazette',
                data: article,
                date: new Date(article.pubDate),
              }) as FeedItem,
          ),
      },
      {
        url: '/api/feed',
        map: (data: { posts: FeedPost[] }) =>
          data.posts
            .filter((post) => {
              if (!post.repostedBy) return true;
              if (post.repostedBy.handle !== COOP_BLUESKY_HANDLE) return false;
              return post.author.handle !== COOP_BLUESKY_HANDLE;
            })
            .map(
              (post) =>
                ({
                  type: 'bluesky',
                  data: post,
                  date: new Date(post.createdAt),
                }) as FeedItem,
            ),
      },
      {
        url: '/api/foodcoop',
        map: (data: { articles: FoodCoopAnnouncement[] }) =>
          data.articles.map(
            (article) =>
              ({
                type: 'foodcoop',
                data: article,
                date: new Date(article.pubDate),
              }) as FeedItem,
          ),
      },
      {
        url: '/api/foodcoopcooks',
        map: (data: { articles: FoodCoopCooksArticle[] }) =>
          data.articles.map(
            (article) =>
              ({
                type: 'foodcoopcooks',
                data: article,
                date: new Date(article.pubDate),
              }) as FeedItem,
          ),
      },
      {
        url: '/api/foodcoopcooks/events',
        map: (data: { events: EventbriteEvent[] }) =>
          data.events.map(
            (event) =>
              ({
                type: 'foodcoopcooks-events',
                data: event,
                date: new Date(event.startUtc),
              }) as FeedItem,
          ),
      },
      {
        url: '/api/wordsprouts/events',
        map: (data: { events: EventbriteEvent[] }) =>
          data.events.map(
            (event) =>
              ({
                type: 'wordsprouts-events',
                data: event,
                date: new Date(event.startUtc),
              }) as FeedItem,
          ),
      },
      {
        url: '/api/concert-series/events',
        map: (data: { events: EventbriteEvent[] }) =>
          data.events.map(
            (event) =>
              ({
                type: 'concert-series-events',
                data: event,
                date: new Date(event.startUtc),
              }) as FeedItem,
          ),
      },
      {
        url: '/api/foodcoop/gm-events',
        map: (data: { events: FoodcoopEvent[] }) =>
          data.events.map(
            (event) =>
              ({
                type: 'gm-events',
                data: event,
                date: new Date(event.startUtc),
              }) as FeedItem,
          ),
      },
      {
        url: '/api/produce/updates',
        map: (data: { events: ProduceEvent[] }) =>
          data.events.map(
            (event) =>
              ({
                type: 'produce',
                data: event,
                date: new Date(`${event.date}T07:00:00`),
              }) as FeedItem,
          ),
      },
    ];

    state = {
      ...state,
      loading: true,
      error: '',
      pendingSources: sources.length,
      items: [],
    };
    dispatchState();

    const appendItems = (incoming: FeedItem[]) => {
      const seen = new Set(state.items.map(getFeedItemKey));
      const merged = [...state.items];
      for (const item of incoming) {
        if (!seen.has(getFeedItemKey(item))) {
          merged.push(item);
        }
      }
      state = { ...state, items: sortAndPrune(merged) };
      dispatchState();
    };

    let successCount = 0;
    await Promise.all(
      sources.map(async (source) => {
        try {
          const response = await fetch(source.url);
          if (response.ok) {
            successCount += 1;
            const data = await response.json();
            appendItems(source.map(data));
          }
        } catch {
          // Ignore per-source failures.
        } finally {
          state = { ...state, pendingSources: Math.max(0, state.pendingSources - 1) };
          dispatchState();
        }
      }),
    );

    state = {
      ...state,
      items: sortAndPrune(state.items),
      loading: false,
      error: successCount === 0 && state.items.length === 0 ? 'Failed to load feed' : '',
    };
    dispatchState();
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
