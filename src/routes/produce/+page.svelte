<script lang="ts">
  import { onMount } from 'svelte';
  import { clearProduceCache, readProduceCache, writeProduceCache } from '@/lib/produce-cache';
  import { loadProduceData } from '@/lib/produce-data-api-loader';
  import ProduceAnalytics from '@/components/produce/ProduceAnalytics.svelte';
  import { getCurrentStickyVisibility } from '@/lib/sticky-visibility';
  import type { PageData } from './$types';
  import type {
    ProduceDateRange,
    ProduceHistoryMap,
    ProduceRow,
    ProduceSWRPeriod,
  } from '@/lib/produce-types';

  const SWR_REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;
  const SWR_PERIODS = new Set<ProduceSWRPeriod>([
    '1Y',
    '5Y',
    'SINCE_2013',
    'YTD',
  ]);

  const channel = `produce-${Math.random().toString(36).slice(2)}`;
  let { data }: { data: PageData } = $props();
  const periodRefreshAt = new Map<ProduceSWRPeriod, number>();
  let isFetching = false;
  let isSyncingFavorites = false;

  function parseFavorites(stored: string | null): string[] {
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is string => typeof item === 'string');
    } catch {
      return [];
    }
  }

  function writeFavorites(favorites: string[]) {
    try {
      const snapshot = JSON.stringify(favorites);
      localStorage.setItem('produce-favorites', snapshot);
      localStorage.setItem('produce-favorites-cache', snapshot);
      state = { ...state, favoritesSnapshot: snapshot };
      window.dispatchEvent(new Event('produce-favorites'));
      window.dispatchEvent(new Event('produce-favorites-cache'));
      dispatchState();
    } catch {
      // Ignore local storage errors.
    }
  }

  async function syncFavoritesFromServer() {
    if (isSyncingFavorites) return;
    isSyncingFavorites = true;

    try {
      const response = await fetch('/api/me/produce-favorites', {
        method: 'GET',
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = (await response.json()) as { favorites?: string[] };
      if (!Array.isArray(data.favorites)) return;
      writeFavorites(data.favorites);
    } catch {
      // Ignore sync failures and use local favorites.
    } finally {
      isSyncingFavorites = false;
    }
  }

  async function toggleFavorite(name: string) {
    const current = new Set(
      (() => {
        try {
          return parseFavorites(localStorage.getItem('produce-favorites'));
        } catch {
          return [] as string[];
        }
      })(),
    );
    if (current.has(name)) {
      current.delete(name);
    } else {
      current.add(name);
    }
    writeFavorites(Array.from(current));

    try {
      const response = await fetch('/api/me/produce-favorites', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ itemName: name }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as { favorites?: string[] };
      if (!Array.isArray(data.favorites)) return;
      writeFavorites(data.favorites);
    } catch {
      // Ignore server failures and keep local state.
    }
  }

  let state = {
    data: [] as ProduceRow[],
    history: new Map<string, Array<{ name: string; date: string; price: number }>>() as ProduceHistoryMap,
    dateRange: null as ProduceDateRange | null,
    isLoading: true,
    isRefreshing: false,
    error: '',
    revalidateForPeriod: (_period: ProduceSWRPeriod) => {
      void revalidateForPeriod(_period);
    },
    initialDateFilter: null as string | null,
    initialItemFilter: null as string | null,
    initialProduceFilter: null as string | null,
    showSticky: getCurrentStickyVisibility(),
    favoritesSnapshot: '[]',
    toggleFavorite: (name: string) => {
      void toggleFavorite(name);
    },
  };

  const initialState = state;

  function serializeJsonLd(payload: unknown): string {
    return JSON.stringify(payload).replaceAll('<', '\\u003c');
  }

  function buildProduceItemList(
    listName: string,
    items: PageData['newArrivals'],
    changeLabel: 'available' | 'unavailable',
  ) {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: listName,
      numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Thing',
          name: item.name,
          url: item.url,
          description: `First seen ${changeLabel} on ${item.date}`,
        },
      })),
    };
  }

  function dispatchState() {
    window.dispatchEvent(
      new CustomEvent(`produce-analytics-state:update:${channel}`, {
        detail: state,
      }),
    );
  }

  function shouldIncludeLongRange(period?: ProduceSWRPeriod): boolean {
    return period === '5Y' || period === 'SINCE_2013';
  }

  async function loadProduce({ refreshing, period }: { refreshing: boolean; period?: ProduceSWRPeriod }) {
    if (isFetching) return;
    isFetching = true;

    state = {
      ...state,
      isLoading: !refreshing,
      isRefreshing: refreshing,
      error: '',
    };
    dispatchState();

    try {
      const data = await loadProduceData({ includeLongRange: shouldIncludeLongRange(period) });

      state = {
        ...state,
        data: data.data,
        history: data.history,
        dateRange: data.dateRange,
        isLoading: false,
        isRefreshing: false,
      };
      writeProduceCache(data.data, data.history, data.dateRange);
      dispatchState();
    } catch (error) {
      try {
        clearProduceCache();
        const retryData = await loadProduceData({ includeLongRange: shouldIncludeLongRange(period) });
        state = {
          ...state,
          data: retryData.data,
          history: retryData.history,
          dateRange: retryData.dateRange,
          isLoading: false,
          isRefreshing: false,
        };
        writeProduceCache(retryData.data, retryData.history, retryData.dateRange);
        dispatchState();
      } catch (retryError) {
        state = {
          ...state,
          error: retryError instanceof Error ? retryError.message : 'Failed to load produce data',
          isLoading: false,
          isRefreshing: false,
        };
        dispatchState();
      }
    } finally {
      isFetching = false;
    }
  }

  async function revalidateForPeriod(period: ProduceSWRPeriod) {
    if (!SWR_PERIODS.has(period)) return;
    const now = Date.now();
    const lastRefreshAt = periodRefreshAt.get(period) ?? 0;
    if (now - lastRefreshAt < SWR_REVALIDATE_INTERVAL_MS) return;
    periodRefreshAt.set(period, now);
    await loadProduce({ refreshing: true, period });
  }

  onMount(() => {
    const stickyVisibilityHandler = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      state = { ...state, showSticky: Boolean(event.detail) };
      dispatchState();
    };

    const params = new URLSearchParams(window.location.search);
    const favorites = localStorage.getItem('produce-favorites') ?? '[]';
    const cached = readProduceCache();
    const shouldRefreshImmediately =
      !cached || Date.now() - cached.cachedAt >= SWR_REVALIDATE_INTERVAL_MS;

    state = {
      ...state,
      favoritesSnapshot: favorites,
      initialDateFilter: params.get('date'),
      initialItemFilter: params.get('item'),
      initialProduceFilter: params.get('produce'),
      data: cached?.data ?? state.data,
      history: cached?.history ?? state.history,
      dateRange: cached?.dateRange ?? state.dateRange,
      isLoading: !cached,
      isRefreshing: Boolean(cached) && shouldRefreshImmediately,
    };
    dispatchState();
    void syncFavoritesFromServer();

    window.addEventListener('sticky-visibility', stickyVisibilityHandler as EventListener);

    void (async () => {
      if (shouldRefreshImmediately) {
        await loadProduce({ refreshing: Boolean(cached) });
      } else {
        state = {
          ...state,
          isLoading: false,
          isRefreshing: false,
        };
        dispatchState();
      }
    })();

    return () => {
      window.removeEventListener('sticky-visibility', stickyVisibilityHandler as EventListener);
    };
  });

  const newArrivalsJsonLd = $derived(
    serializeJsonLd(buildProduceItemList('Produce New Arrivals', data.newArrivals, 'available')),
  );
  const outOfStockJsonLd = $derived(
    serializeJsonLd(buildProduceItemList('Produce Out of Stock', data.outOfStock, 'unavailable')),
  );
</script>

<svelte:head>
  <svelte:element this={'script'} type="application/ld+json">{newArrivalsJsonLd}</svelte:element>
  <svelte:element this={'script'} type="application/ld+json">{outOfStockJsonLd}</svelte:element>
</svelte:head>

<ProduceAnalytics {channel} {initialState} />
