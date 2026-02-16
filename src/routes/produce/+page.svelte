<script lang="ts">
  import { onMount } from 'svelte';
  import { clearProduceCache, readProduceCache, writeProduceCache } from '@/lib/produce-cache';
  import { loadProduceData } from '@/lib/produce-data-api-loader';
  import ProduceAnalytics from '@/components/produce/ProduceAnalytics.svelte';
  import { getCurrentStickyVisibility } from '@/lib/sticky-visibility';
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
  const periodRefreshAt = new Map<ProduceSWRPeriod, number>();
  let isFetching = false;

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
      try {
        const stored = localStorage.getItem('produce-favorites');
        const parsed = stored ? (JSON.parse(stored) as string[]) : [];
        const set = new Set(parsed);
        if (set.has(name)) {
          set.delete(name);
        } else {
          set.add(name);
        }
        localStorage.setItem('produce-favorites', JSON.stringify(Array.from(set)));
        state = { ...state, favoritesSnapshot: JSON.stringify(Array.from(set)) };
        window.dispatchEvent(new Event('produce-favorites'));
        dispatchState();
      } catch {
        // Ignore local storage errors.
      }
    },
  };

  const initialState = state;

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
</script>

<ProduceAnalytics {channel} {initialState} />
