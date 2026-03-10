<script lang="ts">
  import { page } from '$app/state';
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
  type ProduceQuickFilter = 'favorites' | 'new' | 'recently_unavailable';

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
  let canSyncFavoritesWithServer: boolean | null = null;
  let favoriteSyncAuthCheckPromise: Promise<boolean> | null = null;

  function parseFavorites(stored: string | null): string[] {
    if (!stored) {return [];}
    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {return [];}
      return parsed.filter((item): item is string => typeof item === 'string');
    } catch {
      return [];
    }
  }

  function writeFavorites(favorites: string[]) : void {
    try {
      const snapshot = JSON.stringify(favorites);
      if (snapshot === state.favoritesSnapshot) {return;}
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

  async function resolveFavoriteSyncAuth(): Promise<boolean> {
    if (canSyncFavoritesWithServer !== null) {
      return canSyncFavoritesWithServer;
    }
    if (favoriteSyncAuthCheckPromise) {
      return favoriteSyncAuthCheckPromise;
    }

    favoriteSyncAuthCheckPromise = (async () : Promise<boolean> => {
      try {
        const response = await fetch('/api/auth/get-session', {
          method: 'GET',
          cache: 'no-store',
        });
        if (!response.ok) {
          canSyncFavoritesWithServer = false;
          return false;
        }

        const session = (await response.json()) as { user?: unknown } | null;
        const isAuthenticated = Boolean(session?.user);
        canSyncFavoritesWithServer = isAuthenticated;
        return isAuthenticated;
      } catch {
        canSyncFavoritesWithServer = false;
        return false;
      } finally {
        favoriteSyncAuthCheckPromise = null;
      }
    })();

    return favoriteSyncAuthCheckPromise;
  }

  async function syncFavoritesFromServer() : Promise<void> {
    if (isSyncingFavorites) {return;}
    if (!(await resolveFavoriteSyncAuth())) {return;}
    isSyncingFavorites = true;

    try {
      const response = await fetch('/api/me/produce-favorites', {
        method: 'GET',
        cache: 'no-store',
      });
      if (response.status === 401) {
        canSyncFavoritesWithServer = false;
        return;
      }
      if (!response.ok) {return;}
      const data = (await response.json()) as { favorites?: string[] };
      if (!Array.isArray(data.favorites)) {return;}
      writeFavorites(data.favorites);
    } catch {
      // Ignore sync failures and use local favorites.
    } finally {
      isSyncingFavorites = false;
    }
  }

  async function toggleFavorite(name: string) : Promise<void> {
    const current = new Set(
      (() : string[] => {
        try {
          return parseFavorites(localStorage.getItem('produce-favorites'));
        } catch {
          return [] as string[];
        }
      })(),
    );
    const nextFavorited = !current.has(name);
    if (nextFavorited) {
      current.add(name);
    } else {
      current.delete(name);
    }
    writeFavorites(Array.from(current));

    if (!(await resolveFavoriteSyncAuth())) {
      return;
    }

    try {
      const response = await fetch('/api/me/produce-favorites', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ itemName: name, favorited: nextFavorited }),
      });
      if (response.status === 401) {
        canSyncFavoritesWithServer = false;
        return;
      }
      if (!response.ok) {return;}
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
    revalidateForPeriod: (_period: ProduceSWRPeriod) : void => {
      void revalidateForPeriod(_period);
    },
    initialDateFilter: null as string | null,
    initialItemFilter: null as string | null,
    initialProduceFilter: null as string | null,
    initialQuickFilter: null as ProduceQuickFilter | null,
    showSticky: getCurrentStickyVisibility(),
    favoritesSnapshot: '[]',
    toggleFavorite: (name: string) : void => {
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
  ) : { '@context': string; '@type': string; name: string; numberOfItems: number; itemListElement: { '@type': string; position: number; item: { '@type': string; name: string; url: string; description: string; }; }[]; } {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: listName,
      numberOfItems: items.length,
      itemListElement: items.map((item, index) : { '@type': string; position: number; item: { '@type': string; name: string; url: string; description: string; }; } => ({
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

  function dispatchState() : void {
    window.dispatchEvent(
      new CustomEvent(`produce-analytics-state:update:${channel}`, {
        detail: state,
      }),
    );
  }

  function initialProduceFilterFromParams(params: URLSearchParams): string | null {
    return params.get('produce');
  }

  function initialQuickFilterFromParams(params: URLSearchParams): ProduceQuickFilter | null {
    const filterParam = params.get('filter')?.trim().toLowerCase();
    if (filterParam === 'favorites') {return 'favorites';}
    if (filterParam === 'new') {return 'new';}
    if (filterParam === 'recently_unavailable') {return 'recently_unavailable';}
    return null;
  }

  function shouldIncludeLongRange(period?: ProduceSWRPeriod): boolean {
    return period === '5Y' || period === 'SINCE_2013';
  }

  async function loadProduce({ refreshing, period }: { refreshing: boolean; period?: ProduceSWRPeriod }) : Promise<void> {
    if (isFetching) {return;}
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

  async function revalidateForPeriod(period: ProduceSWRPeriod) : Promise<void> {
    if (!SWR_PERIODS.has(period)) {return;}
    const now = Date.now();
    const lastRefreshAt = periodRefreshAt.get(period) ?? 0;
    if (now - lastRefreshAt < SWR_REVALIDATE_INTERVAL_MS) {return;}
    periodRefreshAt.set(period, now);
    await loadProduce({ refreshing: true, period });
  }

  onMount(() : () => void => {
    const stickyVisibilityHandler = (event: Event) : void => {
      if (!(event instanceof CustomEvent)) {return;}
      state = { ...state, showSticky: Boolean(event.detail) };
      dispatchState();
    };
    const authSessionChangedHandler = () : void => {
      canSyncFavoritesWithServer = null;
      favoriteSyncAuthCheckPromise = null;
      void syncFavoritesFromServer();
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
      initialProduceFilter: initialProduceFilterFromParams(params),
      initialQuickFilter: initialQuickFilterFromParams(params),
      data: cached?.data ?? state.data,
      history: cached?.history ?? state.history,
      dateRange: cached?.dateRange ?? state.dateRange,
      isLoading: !cached,
      isRefreshing: Boolean(cached) && shouldRefreshImmediately,
    };
    dispatchState();
    void syncFavoritesFromServer();

    window.addEventListener('sticky-visibility', stickyVisibilityHandler as EventListener);
    window.addEventListener('auth:session-changed', authSessionChangedHandler);

    void (async () : Promise<void> => {
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

    return () : void => {
      window.removeEventListener('sticky-visibility', stickyVisibilityHandler as EventListener);
      window.removeEventListener('auth:session-changed', authSessionChangedHandler);
    };
  });

  $effect(() : void => {
    if (typeof window === 'undefined') {return;}

    const nextDateFilter = page.url.searchParams.get('date');
    const nextItemFilter = page.url.searchParams.get('item');
    const nextProduceFilter = initialProduceFilterFromParams(page.url.searchParams);
    const nextQuickFilter = initialQuickFilterFromParams(page.url.searchParams);

    if (
      nextDateFilter === state.initialDateFilter &&
      nextItemFilter === state.initialItemFilter &&
      nextProduceFilter === state.initialProduceFilter &&
      nextQuickFilter === state.initialQuickFilter
    ) {
      return;
    }

    state = {
      ...state,
      initialDateFilter: nextDateFilter,
      initialItemFilter: nextItemFilter,
      initialProduceFilter: nextProduceFilter,
      initialQuickFilter: nextQuickFilter,
    };
    dispatchState();
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
