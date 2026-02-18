<script lang="ts">
  import { goto } from '$app/navigation';
  import Fuse from 'fuse.js';
  import { onMount } from 'svelte';
  import ProduceContextMenu from '@/components/produce/ProduceContextMenu.svelte';
  import ProduceSparkline from '@/components/produce/ProduceSparkline.svelte';
  import { produceHash } from '@/lib/produce-hash';
  import { getSpecialtyProduceUrl } from '@/lib/specialty-produce-map';
  import type {
    ProduceDateRange,
    ProduceHistoryMap,
    ProduceHistoryPoint,
    ProduceRow,
    ProduceSWRPeriod,
  } from '@/lib/produce-types';

  type TimePeriod =
    | '1D'
    | '1W'
    | '1M'
    | '1Y'
    | '5Y'
    | 'MAX'
    | 'YTD';
  type SortField = 'name' | 'price' | 'change' | 'first_seen' | 'last_seen';
  type SortDirection = 'asc' | 'desc' | null;
  type QuickFilter = 'favorites' | 'drops' | 'increases' | 'new' | 'recently_unavailable' | null;
  type ProduceSearchDocument = {
    id: string;
    name: string;
    origin: string;
    attributes: string;
  };

  type ProduceAnalyticsClientState = {
    data: ProduceRow[];
    history: ProduceHistoryMap;
    dateRange: ProduceDateRange | null;
    isLoading: boolean;
    isRefreshing: boolean;
    error: string;
    revalidateForPeriod: (period: ProduceSWRPeriod) => void;
    initialDateFilter: string | null;
    initialItemFilter: string | null;
    initialProduceFilter: string | null;
    showSticky: boolean;
    favoritesSnapshot: string;
    toggleFavorite: (name: string) => void;
  };

  const TIME_PERIODS: TimePeriod[] = [
    '1D',
    '1W',
    '1M',
    '1Y',
    'YTD',
    '5Y',
    'MAX',
  ];
  const PERIOD_LABELS: Record<TimePeriod, string> = {
    '1D': '1D',
    '1W': '1W',
    '1M': '1M',
    '1Y': '1Y',
    YTD: 'YTD',
    '5Y': '5Y',
    MAX: 'Max',
  };
  const PERIOD_METRIC_LABELS: Record<TimePeriod, string> = {
    '1D': 'Past day',
    '1W': 'Past week',
    '1M': 'Past month',
    '1Y': 'Past year',
    YTD: 'Year to date',
    '5Y': 'Past 5 years',
    MAX: 'Max range',
  };
  const SWR_PERIODS = new Set<ProduceSWRPeriod>([
    '1Y',
    '5Y',
    'SINCE_2013',
    'YTD',
  ]);
  const NAME_COL_CLASS =
    'w-1/3 min-w-[33.333%] max-w-[33.333%] md:w-2/5 md:min-w-0 md:max-w-none';
  const DATA_COL_CLASS = 'w-1/3 min-w-[33.333%] max-w-[33.333%] md:w-auto md:min-w-0 md:max-w-none';
  const METRIC_VALUE_CLASS = 'w-[7ch] shrink-0 text-right font-mono';

  let {
    channel,
    initialState,
  }: {
    channel: string;
    initialState: ProduceAnalyticsClientState;
  } = $props();

  let data = $state<ProduceRow[]>([]);
  let history = $state<ProduceHistoryMap>(new Map());
  let dateRange = $state<ProduceDateRange | null>(null);
  let isLoading = $state(false);
  let isRefreshing = $state(false);
  let error = $state('');
  let revalidateForPeriod = $state<(period: ProduceSWRPeriod) => void>(() => {});
  let initialDateFilter = $state<string | null>(null);
  let initialItemFilter = $state<string | null>(null);
  let initialProduceFilter = $state<string | null>(null);
  let showSticky = $state(true);
  let favoritesSnapshot = $state('[]');
  let toggleFavorite = $state<(name: string) => void>(() => {});
  let stickyHeaderRef = $state<HTMLDivElement | null>(null);
  let contextMenu = $state<{ itemName: string; x: number; y: number } | null>(null);
  let touchStart = $state<{ itemName: string; x: number; y: number } | null>(null);

  let search = $state('');
  let quickFilter = $state<QuickFilter>(null);
  let timePeriod = $state<TimePeriod>('1D');
  let sortField = $state<SortField | null>('change');
  let sortDirection = $state<SortDirection>('asc');
  let dateFilter = $state<string | null>(null);
  let itemFilter = $state<string | null>(null);
  let didApplyInitialQueryFilters = $state(false);

  const favorites = $derived(parseFavorites(favoritesSnapshot));
  const stickyVisible = $derived(showSticky);
  const normalizedSearch = $derived(search.trim().toLowerCase());
  const hasSearchQuery = $derived(normalizedSearch.length > 0);

  const searchDocs = $derived(
    data.map<ProduceSearchDocument>((row) => ({
      id: produceHash(row.name),
      name: row.name,
      origin: row.origin,
      attributes: getProduceAttributeTerms(row),
    })),
  );

  const produceFuse = $derived(
    new Fuse(searchDocs, {
      includeScore: true,
      shouldSort: true,
      ignoreLocation: true,
      threshold: 0.3,
      keys: [
        { name: 'name', weight: 0.7 },
        { name: 'origin', weight: 0.15 },
        { name: 'attributes', weight: 0.15 },
      ],
    }),
  );

  const searchScores = $derived.by(() => {
    if (!hasSearchQuery) return null;
    const hits = produceFuse.search(normalizedSearch);
    return new Map(hits.map((hit) => [hit.item.id, hit.score ?? Number.MAX_VALUE]));
  });

  function rowMatchesDateFilter(row: ProduceRow, targetDate: string): boolean {
    const arrivedOnDate = row.is_new && row.first_seen_date === targetDate;
    const becameUnavailableOnDate =
      row.is_unavailable && row.unavailable_since_date === targetDate;
    return arrivedOnDate || becameUnavailableOnDate;
  }

  const filteredRows = $derived.by(() => {
    let result = data;

    if (itemFilter) {
      result = result.filter((row) => produceHash(row.name) === itemFilter);
    }

    const selectedDate = dateFilter;
    if (selectedDate) {
      result = result.filter((row) => rowMatchesDateFilter(row, selectedDate));
    }

    if (searchScores) {
      result = result.filter((row) => searchScores.has(produceHash(row.name)));
    }

    if (quickFilter === 'favorites') {
      result = result.filter((row) => favorites.has(row.name));
    } else if (quickFilter === 'new') {
      result = result.filter((row) => row.is_new);
    } else if (quickFilter === 'recently_unavailable') {
      result = result.filter((row) => row.is_unavailable);
    }

    if (searchScores && (!sortField || !sortDirection)) {
      return [...result].sort((a, b) => {
        const aScore = searchScores.get(produceHash(a.name)) ?? Number.MAX_VALUE;
        const bScore = searchScores.get(produceHash(b.name)) ?? Number.MAX_VALUE;
        return aScore - bScore;
      });
    }

    if (!sortField || !sortDirection) {
      return result;
    }

    return [...result].sort((a, b) => {
      if (sortField === 'name') {
        return sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      if (sortField === 'price') {
        return sortDirection === 'asc' ? a.price - b.price : b.price - a.price;
      }
      if (sortField === 'first_seen') {
        const aVal = a.first_seen_date ?? '';
        const bVal = b.first_seen_date ?? '';
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (sortField === 'last_seen') {
        const aVal = a.unavailable_since_date ?? '';
        const bVal = b.unavailable_since_date ?? '';
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      const aPrev = getPreviousPrice(a, timePeriod, history.get(a.name), dateRange);
      const bPrev = getPreviousPrice(b, timePeriod, history.get(b.name), dateRange);
      const aChange = aPrev !== null && aPrev !== 0 ? (a.price - aPrev) / aPrev : 0;
      const bChange = bPrev !== null && bPrev !== 0 ? (b.price - bPrev) / bPrev : 0;
      return sortDirection === 'asc' ? aChange - bChange : bChange - aChange;
    });
  });

  const quickFilterCount = $derived.by(() => {
    let base = data;
    const selectedDate = dateFilter;
    if (selectedDate) {
      base = base.filter((row) => rowMatchesDateFilter(row, selectedDate));
    }
    if (!quickFilter || quickFilter === 'drops' || quickFilter === 'increases') {
      return base.length;
    }
    if (quickFilter === 'favorites') {
      return base.filter((row) => favorites.has(row.name)).length;
    }
    if (quickFilter === 'new') {
      return base.filter((row) => row.is_new).length;
    }
    return base.filter((row) => row.is_unavailable).length;
  });

  const itemFilterName = $derived.by(() => {
    if (!itemFilter) return null;
    return data.find((row) => produceHash(row.name) === itemFilter)?.name ?? null;
  });
  const produceFilterDisplayName = $derived.by(() => {
    if (itemFilterName) return itemFilterName;
    if (!initialProduceFilter) return null;
    const decoded = decodeMaybe(initialProduceFilter).trim();
    if (!decoded) return null;
    const byHash = data.find((row) => produceHash(row.name).toLowerCase() === decoded.toLowerCase());
    if (byHash) return byHash.name;
    return decoded;
  });

  function parseFavorites(stored: string): Set<string> {
    if (!stored) return new Set();
    try {
      return new Set(JSON.parse(stored) as string[]);
    } catch {
      return new Set();
    }
  }

  function decodeMaybe(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function resolveProduceFilterToHash(produceParam: string | null): string | null {
    if (!produceParam) return null;
    const decoded = decodeMaybe(produceParam).trim();
    if (!decoded) return null;

    const byHash = data.find(
      (row) => produceHash(row.name).toLowerCase() === decoded.toLowerCase(),
    );
    if (byHash) return produceHash(byHash.name);

    const byName = data.find((row) => row.name.toLowerCase() === decoded.toLowerCase());
    if (byName) return produceHash(byName.name);

    return null;
  }

  function getProduceAttributeTerms(row: ProduceRow): string {
    const terms: string[] = [];
    if (row.is_organic) terms.push('organic');
    if (row.is_local) terms.push('local');
    if (row.is_ipm) terms.push('ipm');
    if (row.is_hydroponic) terms.push('hydroponic');
    if (row.is_waxed) terms.push('waxed');
    return terms.join(' ');
  }

  function getPeriodStartMs(period: TimePeriod, endMs: number): number {
    const day = 24 * 60 * 60 * 1000;
    switch (period) {
      case '1D':
        return endMs - day;
      case '1W':
        return endMs - 7 * day;
      case '1M':
        return endMs - 30 * day;
      case '1Y':
        return endMs - 365 * day;
      case '5Y':
        return endMs - 1825 * day;
      case 'MAX':
        return new Date('2013-01-01T00:00:00').getTime();
      case 'YTD': {
        const endDate = new Date(endMs);
        return new Date(endDate.getFullYear(), 0, 1).getTime();
      }
      default:
        return endMs - day;
    }
  }

  function historyPrev(
    points: ProduceHistoryPoint[] | undefined,
    activeRange: ProduceDateRange | null,
    period: TimePeriod,
  ): number | null {
    if (!points || points.length === 0) return null;
    const endMs = activeRange
      ? new Date(activeRange.end + 'T00:00:00').getTime()
      : new Date(points[points.length - 1].date + 'T00:00:00').getTime();
    const startMs = getPeriodStartMs(period, endMs);

    let prev: number | null = null;
    let closest = Number.POSITIVE_INFINITY;
    for (const point of points) {
      const ms = new Date(point.date + 'T00:00:00').getTime();
      if (ms > endMs) continue;
      const dist = Math.abs(ms - startMs);
      if (dist < closest) {
        closest = dist;
        prev = point.price;
      }
    }
    return prev;
  }

  function getPreviousPrice(
    row: ProduceRow,
    period: TimePeriod,
    points?: ProduceHistoryPoint[],
    activeRange: ProduceDateRange | null = null,
  ): number | null {
    switch (period) {
      case '1D':
        return row.prev_day_price;
      case '1W':
        return row.prev_week_price;
      case '1M':
        return row.prev_month_price;
      case '1Y':
        return row.prev_year_price;
      case 'YTD':
        return row.prev_ytd_price;
      case '5Y':
      case 'MAX':
        return historyPrev(points, activeRange, period);
      default:
        return row.prev_day_price;
    }
  }

  function getPeriodData(
    row: ProduceRow,
    period: TimePeriod,
    points?: ProduceHistoryPoint[],
    activeRange: ProduceDateRange | null = null,
  ): { prev: number | null; high: number | null; low: number | null } {
    if (period === '1D')
      return { prev: row.prev_day_price, high: row.day_high, low: row.day_low };
    if (period === '1W')
      return { prev: row.prev_week_price, high: row.week_high, low: row.week_low };
    if (period === '1M')
      return { prev: row.prev_month_price, high: row.month_high, low: row.month_low };
    if (period === '1Y')
      return { prev: row.prev_year_price, high: row.year_high, low: row.year_low };
    if (period === 'YTD')
      return { prev: row.prev_ytd_price, high: row.ytd_high, low: row.ytd_low };

    if (!points || points.length === 0) {
      return { prev: null, high: null, low: null };
    }

    const endMs = activeRange
      ? new Date(activeRange.end + 'T00:00:00').getTime()
      : new Date(points[points.length - 1].date + 'T00:00:00').getTime();
    const periodStartMs = getPeriodStartMs(period, endMs);
    let prev: number | null = null;
    let closestPrevDist = Number.POSITIVE_INFINITY;
    let high: number | null = null;
    let low: number | null = null;

    for (const point of points) {
      const pointMs = new Date(point.date + 'T00:00:00').getTime();
      if (pointMs > endMs) continue;

      const prevDist = Math.abs(pointMs - periodStartMs);
      if (prevDist < closestPrevDist) {
        closestPrevDist = prevDist;
        prev = point.price;
      }

      if (pointMs < periodStartMs) continue;
      if (high === null || point.price > high) high = point.price;
      if (low === null || point.price < low) low = point.price;
    }

    return { prev, high, low };
  }

  function getPeriodPointCount(
    points: ProduceHistoryPoint[] | undefined,
    activeRange: ProduceDateRange | null,
    period: TimePeriod,
  ): number {
    if (!points || points.length === 0) return 0;
    const endMs = activeRange
      ? new Date(activeRange.end + 'T00:00:00').getTime()
      : new Date(points[points.length - 1].date + 'T00:00:00').getTime();
    const periodStartMs = getPeriodStartMs(period, endMs);
    return points.filter((point) => {
      const pointMs = new Date(point.date + 'T00:00:00').getTime();
      return pointMs >= periodStartMs && pointMs <= endMs;
    }).length;
  }

  function metricLabel(period: TimePeriod): string {
    return PERIOD_METRIC_LABELS[period];
  }

  function quickFilterPillLabel(filter: QuickFilter): string {
    if (filter === 'favorites') return 'Favorites';
    if (filter === 'new') return 'New Arrivals';
    if (filter === 'recently_unavailable') return 'Out of Stock';
    return 'Filter';
  }

  function quickFilterPillClass(filter: QuickFilter): string {
    if (filter === 'favorites') return 'bg-amber-100 text-amber-800';
    if (filter === 'new') return 'bg-[rgb(255,246,220)] text-[#3F7540]';
    if (filter === 'recently_unavailable') return 'bg-red-100 text-red-700';
    return 'bg-zinc-100 text-zinc-700';
  }

  function activeViewFilter(): 'favorites' | 'new' | 'recently_unavailable' | 'date' | null {
    if (dateFilter) return 'date';
    if (quickFilter === 'favorites') return 'favorites';
    if (quickFilter === 'new') return 'new';
    if (quickFilter === 'recently_unavailable') return 'recently_unavailable';
    return null;
  }

  function activeFilterPillLabel(): string {
    const filter = activeViewFilter();
    if (filter === 'date' && dateFilter) return formatShortDate(dateFilter);
    if (filter === 'date') return 'All';
    return filter ? quickFilterPillLabel(filter) : 'All';
  }

  function activeFilterPillClass(): string {
    const filter = activeViewFilter();
    if (filter === 'date') return 'bg-blue-100 text-blue-800';
    return filter ? quickFilterPillClass(filter) : 'bg-zinc-900 text-white';
  }

  function shouldShowViewFilterPill(): boolean {
    if (produceFilterDisplayName) return false;
    return true;
  }

  function clearQuickFilter() {
    quickFilter = null;
    sortField = 'name';
    sortDirection = 'asc';
  }

  function formatShortDate(isoDate: string): string {
    const date = new Date(isoDate + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  }

  function setPriceTrendFilter(next: 'drops' | 'increases') {
    sortField = 'change';
    sortDirection = next === 'drops' ? 'asc' : 'desc';
  }

  function clearDateFilter() {
    dateFilter = null;
    const url = new URL(window.location.href);
    url.searchParams.delete('date');
    void goto(url.pathname + url.search, { keepFocus: true, noScroll: true, replaceState: true });
  }

  function clearQueryFilters() {
    dateFilter = null;
    itemFilter = null;
    initialProduceFilter = null;
    const url = new URL(window.location.href);
    url.searchParams.delete('date');
    url.searchParams.delete('item');
    url.searchParams.delete('produce');
    url.searchParams.delete('name');
    void goto(url.pathname + url.search, { keepFocus: true, noScroll: true, replaceState: true });
  }

  function clearItemFilter() {
    itemFilter = null;
    initialProduceFilter = null;
    const url = new URL(window.location.href);
    url.searchParams.delete('item');
    url.searchParams.delete('produce');
    url.searchParams.delete('name');
    void goto(url.pathname + url.search, { keepFocus: true, noScroll: true, replaceState: true });
  }

  function isSparklineTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest('[data-sparkline-interactive="true"]') !== null;
  }

  function isProduceNameTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest('[data-produce-name="true"]') !== null;
  }

  function clearTouchStart() {
    touchStart = null;
  }

  function handleContextMenu(event: MouseEvent, itemName: string) {
    if (isProduceNameTarget(event.target)) return;
    event.preventDefault();
    contextMenu = { itemName, x: event.clientX, y: event.clientY };
  }

  function handleTouchStart(event: TouchEvent, itemName: string) {
    if (isProduceNameTarget(event.target)) return;
    if (isSparklineTarget(event.target)) return;
    if (event.touches.length === 0) return;
    const touch = event.touches[0];
    touchStart = { itemName, x: touch.clientX, y: touch.clientY };
  }

  function handleTouchMove(event: TouchEvent, itemName: string) {
    if (!touchStart || touchStart.itemName !== itemName || event.touches.length === 0) return;
    const touch = event.touches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      clearTouchStart();
    }
  }

  function handleTouchEnd(event: TouchEvent, itemName: string) {
    if (!touchStart || touchStart.itemName !== itemName || event.changedTouches.length === 0) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    clearTouchStart();
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) return;
    event.preventDefault();
    event.stopPropagation();
    contextMenu = { itemName, x: touch.clientX, y: touch.clientY };
  }

  function handleTouchCancel() {
    clearTouchStart();
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        sortDirection = 'desc';
      } else if (sortDirection === 'desc') {
        sortField = null;
        sortDirection = null;
      } else {
        sortDirection = 'asc';
      }
    } else {
      sortField = field;
      sortDirection = 'asc';
    }
  }

  function sortArrow(field: SortField): string {
    if (sortField !== field || sortDirection === null) return '';
    return sortDirection === 'asc' ? '↑' : '↓';
  }

  function applyState(next: ProduceAnalyticsClientState) {
    data = next.data;
    history = next.history;
    dateRange = next.dateRange;
    isLoading = next.isLoading;
    isRefreshing = next.isRefreshing;
    error = next.error;
    revalidateForPeriod = next.revalidateForPeriod;
    initialDateFilter = next.initialDateFilter;
    initialItemFilter = next.initialItemFilter;
    initialProduceFilter = next.initialProduceFilter;
    showSticky = next.showSticky;
    favoritesSnapshot = next.favoritesSnapshot;
    toggleFavorite = next.toggleFavorite;
  }

  function applyInitialQueryFilters() {
    if (didApplyInitialQueryFilters) return;
    if (!(initialItemFilter || initialProduceFilter || initialDateFilter)) return;

    quickFilter = null;
    dateFilter = initialDateFilter;
    itemFilter = initialItemFilter ?? null;
    if (!itemFilter && initialProduceFilter) {
      const isHashParam = /^[a-f0-9]{7}$/i.test(initialProduceFilter.trim());
      itemFilter = isHashParam ? initialProduceFilter.trim().toLowerCase() : null;
    }
    sortField = initialDateFilter ? null : 'name';
    sortDirection = initialDateFilter ? null : 'asc';
    didApplyInitialQueryFilters = true;
  }

  function handleStateUpdate(event: Event) {
    if (!(event instanceof CustomEvent)) return;
    applyState(event.detail as ProduceAnalyticsClientState);
  }

  $effect(() => {
    const swrPeriod: ProduceSWRPeriod | null =
      timePeriod === 'MAX'
        ? 'SINCE_2013'
        : timePeriod === '1Y' || timePeriod === '5Y' || timePeriod === 'YTD'
          ? timePeriod
          : null;
    if (swrPeriod && SWR_PERIODS.has(swrPeriod)) revalidateForPeriod(swrPeriod);
  });

  $effect(() => {
    localStorage.setItem(
      'produce-filters',
      JSON.stringify({ quickFilter, timePeriod, sortField, sortDirection }),
    );
  });

  onMount(() => {
    applyState(initialState);
    applyInitialQueryFilters();

    if (!didApplyInitialQueryFilters) {
      try {
        const stored = localStorage.getItem('produce-filters');
        if (stored) {
          const parsed = JSON.parse(stored) as {
            quickFilter?: QuickFilter;
            timePeriod?: TimePeriod;
            sortField?: SortField | null;
            sortDirection?: SortDirection;
          };
          const persistedQuickFilter = parsed.quickFilter;
          quickFilter =
            persistedQuickFilter === 'favorites' ||
            persistedQuickFilter === 'new' ||
            persistedQuickFilter === 'recently_unavailable'
              ? persistedQuickFilter
              : quickFilter;
          if (parsed.timePeriod && TIME_PERIODS.includes(parsed.timePeriod)) {
            timePeriod = parsed.timePeriod;
          }
          sortField = parsed.sortField ?? sortField;
          sortDirection = parsed.sortDirection ?? sortDirection;
        }
      } catch {
        // ignore persisted filter parse issues
      }
    }

    const handler = (event: Event) => handleStateUpdate(event);
    window.addEventListener(`produce-analytics-state:update:${channel}`, handler as EventListener);

    return () => {
      window.removeEventListener(`produce-analytics-state:update:${channel}`, handler as EventListener);
      clearTouchStart();
    };
  });

  $effect(() => {
    applyInitialQueryFilters();
  });

  $effect(() => {
    if (!itemFilter && initialProduceFilter && data.length > 0) {
      const resolved = resolveProduceFilterToHash(initialProduceFilter);
      if (resolved) {
        itemFilter = resolved;
      }
    }
  });

  $effect(() => {
    const element = stickyHeaderRef;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const updateHeight = () => {
      window.dispatchEvent(new CustomEvent('sticky-threshold', { detail: element.offsetHeight }));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);

    return () => observer.disconnect();
  });
</script>

<div class="mx-auto max-w-3xl px-4 pb-6">
  <div
    bind:this={stickyHeaderRef}
    class={`sticky top-24 z-20 bg-white transition-opacity duration-300 ease-in-out motion-reduce:transition-none md:top-14 ${
      stickyVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
    }`}
  >
    <h1 class="py-6 text-2xl font-bold text-zinc-900">Produce</h1>

    <div class="mb-4">
      <div class="flex w-full max-w-md items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2">
        {#if produceFilterDisplayName}
          <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800">
            <span class="max-w-[120px] truncate">{produceFilterDisplayName}</span>
            <button
              type="button"
              aria-label="Remove item filter"
              onclick={(e) => {
                e.stopPropagation();
                clearItemFilter();
              }}
              class="ml-0.5 rounded-full p-0.5 transition hover:opacity-70"
            >
              ✕
            </button>
          </span>
        {/if}

        {#if shouldShowViewFilterPill()}
          <span
            class={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${activeFilterPillClass()}`}
          >
            <span class="max-w-[120px] truncate">{activeFilterPillLabel()}</span>
            {#if activeViewFilter() === 'date'}
              <button
                type="button"
                aria-label="Remove date filter"
                onclick={(e) => {
                  e.stopPropagation();
                  clearDateFilter();
                }}
                class="ml-0.5 rounded-full p-0.5 transition hover:opacity-70"
              >
                ✕
              </button>
            {:else if activeViewFilter()}
              <button
                type="button"
                aria-label="Remove quick filter"
                onclick={(e) => {
                  e.stopPropagation();
                  clearQuickFilter();
                }}
                class="ml-0.5 rounded-full p-0.5 transition hover:opacity-70"
              >
                ✕
              </button>
            {/if}
          </span>
        {/if}

        <input
          type="search"
          value={search}
          oninput={(e) => {
            search = e.currentTarget.value;
          }}
          placeholder="Search produce..."
          class="min-w-0 flex-1 bg-transparent text-zinc-900 placeholder-zinc-500 outline-none"
        />
      </div>

      <div class="p-2 text-sm text-zinc-500">
        {#if isLoading}
          <div class="feed-shimmer h-5 w-32 rounded"></div>
        {:else}
          Showing {filteredRows.length} of {quickFilterCount} items
          {#if dateRange}
            {' · Last updated '}
            {new Date(dateRange.end + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          {/if}
          <span
            class={`ml-2 inline-block animate-spin transition-opacity duration-300 ${
              isRefreshing ? 'opacity-100' : 'opacity-0'
            }`}
          >
            🥕
          </span>
        {/if}
      </div>
    </div>

    <div class="mb-4 flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onclick={() => {
            clearQueryFilters();
            quickFilter = null;
            sortField = 'name';
            sortDirection = 'asc';
          }}
          class={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
            !quickFilter && !dateFilter && !itemFilter
              ? 'bg-zinc-900 text-white'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          All
        </button>

        <button
          type="button"
          onclick={() => {
            clearQueryFilters();
            quickFilter = quickFilter === 'favorites' ? null : 'favorites';
            sortField = 'name';
            sortDirection = 'asc';
          }}
          class={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
            quickFilter === 'favorites'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Favorites
        </button>

        <button
          type="button"
          onclick={() => {
            clearQueryFilters();
            quickFilter = quickFilter === 'new' ? null : 'new';
            sortField = 'first_seen';
            sortDirection = 'desc';
          }}
          class={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
            quickFilter === 'new'
              ? 'bg-[rgb(255,246,220)] text-[#3F7540]'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          New Arrivals
        </button>

        <button
          type="button"
          onclick={() => {
            clearQueryFilters();
            quickFilter = quickFilter === 'recently_unavailable' ? null : 'recently_unavailable';
            sortField = 'last_seen';
            sortDirection = 'desc';
          }}
          class={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
            quickFilter === 'recently_unavailable'
              ? 'bg-red-100 text-red-700'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Out of Stock
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onclick={() => {
            clearQueryFilters();
            setPriceTrendFilter('drops');
          }}
          class={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
            sortField === 'change' && sortDirection === 'asc'
              ? 'bg-green-100 text-green-700'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Price Drops
        </button>

        <button
          type="button"
          onclick={() => {
            clearQueryFilters();
            setPriceTrendFilter('increases');
          }}
          class={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
            sortField === 'change' && sortDirection === 'desc'
              ? 'bg-red-100 text-red-700'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Price Increases
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-1">
        {#each TIME_PERIODS as period (period)}
          <button
            type="button"
            onclick={() => {
              timePeriod = period;
            }}
            class={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              timePeriod === period
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {PERIOD_LABELS[period]}
          </button>
        {/each}
      </div>
    </div>

    {#if error && !isLoading}
      <div class="mb-4 text-sm text-red-600">{error}</div>
    {/if}

    <table class="w-full min-w-full table-fixed text-sm">
      <colgroup>
        <col class={NAME_COL_CLASS} />
        <col class={DATA_COL_CLASS} />
        <col class={DATA_COL_CLASS} />
      </colgroup>
      <thead>
        <tr class="border-b border-zinc-200">
          <th
            class={`${NAME_COL_CLASS} sticky left-0 z-10 box-border border-r border-zinc-200 bg-white px-2 py-3 text-left font-medium whitespace-nowrap text-zinc-600 select-none hover:text-zinc-900 md:border-r-0`}
            onclick={() => handleSort('name')}
          >
            Name<span class={`ml-1 inline-block w-3 ${sortArrow('name') ? '' : 'invisible'}`}
              >{sortArrow('name')}</span
            >
          </th>
          <th
            class={`${DATA_COL_CLASS} box-border cursor-pointer px-2 py-3 text-left font-medium whitespace-nowrap text-zinc-600 select-none hover:text-zinc-900`}
            onclick={() => handleSort('price')}
          >
            Price<span class={`ml-1 inline-block w-3 ${sortArrow('price') ? '' : 'invisible'}`}
              >{sortArrow('price')}</span
            >
          </th>
          <th
            class={`${DATA_COL_CLASS} box-border cursor-pointer px-2 py-3 text-left font-medium whitespace-nowrap text-zinc-600 select-none hover:text-zinc-900`}
            onclick={() => handleSort('change')}
          >
            {metricLabel(timePeriod)}<span
              class={`ml-1 inline-block w-3 ${sortArrow('change') ? '' : 'invisible'}`}
              >{sortArrow('change')}</span
            >
          </th>
        </tr>
      </thead>
    </table>
  </div>

  <div class="overflow-x-hidden transition-opacity duration-300 ease-in-out motion-reduce:transition-none">
    <table class="w-full min-w-full table-fixed text-sm">
      <colgroup>
        <col class={NAME_COL_CLASS} />
        <col class={DATA_COL_CLASS} />
        <col class={DATA_COL_CLASS} />
      </colgroup>
      <tbody>
        {#if isLoading}
          {#each Array.from({ length: 8 }) as _, idx (idx)}
            <tr class="border-b border-zinc-100">
              <td
                class={`px-2 py-3 ${NAME_COL_CLASS} sticky left-0 z-10 box-border border-r border-zinc-200 bg-white md:w-auto md:border-r-0`}
              >
                <div class="space-y-1">
                  <div class="feed-shimmer h-4 w-full rounded"></div>
                  <div class="feed-shimmer h-3 w-2/3 rounded"></div>
                </div>
              </td>
              <td class={`px-2 py-3 ${DATA_COL_CLASS} box-border`}>
                <div class="flex h-full items-center">
                  <div class="feed-shimmer h-4 w-full rounded"></div>
                </div>
              </td>
              <td class={`px-2 py-3 ${DATA_COL_CLASS} box-border`}>
                <div class="space-y-1">
                  <div class="feed-shimmer h-3 w-20 rounded"></div>
                  <div class="feed-shimmer h-3 w-16 rounded"></div>
                  <div class="feed-shimmer h-3 w-18 rounded"></div>
                  <div class="feed-shimmer h-3 w-18 rounded"></div>
                </div>
              </td>
            </tr>
          {/each}
        {:else if quickFilter === 'favorites' && favorites.size === 0}
          <tr>
            <td colspan="3" class="px-2 py-12 text-center">
              <p class="mx-auto max-w-xs text-sm text-zinc-500">
                You have no produce favorites at the Coop :( Search for produce items to favorite and
                stay up to date.
              </p>
            </td>
          </tr>
        {:else if filteredRows.length === 0}
          <tr>
            <td colspan="3" class="px-2 py-12 text-center">
              <p class="text-sm text-zinc-500">No results found. Try a different search.</p>
            </td>
          </tr>
        {:else}
          {#each filteredRows as row (row.name)}
            {@const rowHistory = history.get(row.name)}
            {@const periodData = getPeriodData(row, timePeriod, rowHistory, dateRange)}
            {@const prev = periodData.prev}
            {@const change = prev !== null ? row.price - prev : null}
            {@const pct = prev !== null && prev !== 0 ? ((row.price - prev) / prev) * 100 : null}
            {@const showHighLow = getPeriodPointCount(rowHistory, dateRange, timePeriod) >= 3}
            {@const specialtyUrl = getSpecialtyProduceUrl(row.name)}
            <tr
              class={`group select-none border-b border-zinc-100 ${favorites.has(row.name) ? 'bg-amber-50' : 'hover:bg-zinc-50'}`}
              oncontextmenu={(e) => handleContextMenu(e, row.name)}
              ontouchstart={(e) => handleTouchStart(e, row.name)}
              ontouchmove={(e) => handleTouchMove(e, row.name)}
              ontouchend={(e) => handleTouchEnd(e, row.name)}
              ontouchcancel={handleTouchCancel}
            >
              <td
                class={`${NAME_COL_CLASS} sticky left-0 z-10 box-border border-r border-zinc-200 p-2 md:w-auto md:border-r-0 ${
                  favorites.has(row.name) ? 'bg-amber-50' : 'bg-white group-hover:bg-zinc-50'
                }`}
              >
                <div class="flex items-start gap-2">
                  <button
                    type="button"
                    class={`hidden h-3.5 w-3.5 shrink-0 self-center items-center justify-center rounded-sm border text-[9px] font-bold md:inline-flex ${
                      favorites.has(row.name)
                        ? 'border-zinc-200 bg-amber-100 text-amber-700'
                        : 'border-zinc-200 bg-white text-zinc-400 hover:bg-amber-100 hover:text-amber-700'
                    }`}
                    onclick={() => toggleFavorite(row.name)}
                    aria-label={favorites.has(row.name)
                      ? `Remove ${row.name} from favorites`
                      : `Add ${row.name} to favorites`}
                  >
                    {favorites.has(row.name) ? '⭐' : '+'}
                  </button>

                  <div class="min-w-0">
                    <div
                      class="line-clamp-3 text-sm font-medium text-zinc-900 md:line-clamp-none"
                      data-produce-name="true"
                    >
                      {#if specialtyUrl}
                        <a href={specialtyUrl} target="_blank" rel="noreferrer" class="hover:underline">
                          <span class={row.is_unavailable ? 'line-through' : undefined}>
                            {row.name} ↗
                          </span>
                        </a>
                      {:else}
                        <span class={row.is_unavailable ? 'line-through' : undefined}>
                          {row.name}
                        </span>
                      {/if}
                    </div>

                    <div class="text-xs text-zinc-500">
                      {#if row.is_unavailable && row.unavailable_since_date}
                        <span class="rounded bg-red-100 px-1 text-red-700">
                          <span class="inline-block">Out of stock</span>{' '}
                          <span class="inline-block">{formatShortDate(row.unavailable_since_date)}</span>
                        </span>
                      {/if}
                      {#if row.is_unavailable && row.unavailable_since_date && row.is_new}
                        {' · '}
                      {/if}
                      {#if row.is_new}
                        <span class="rounded bg-[rgb(255,246,220)] px-1 text-[#3F7540]">
                          <span class="inline-block">New arrival</span>
                          {#if row.first_seen_date}
                            {' '}
                            <span class="inline-block">{formatShortDate(row.first_seen_date)}</span>
                          {/if}
                        </span>
                      {/if}
                      {#if (row.is_unavailable || row.is_new) && (row.is_hydroponic || row.is_ipm || row.is_local || row.is_organic || row.is_waxed)}
                        {' · '}
                      {/if}
                      {#if row.is_hydroponic}
                        <span>Hydroponic</span>
                      {/if}
                      {#if row.is_hydroponic && (row.is_ipm || row.is_local || row.is_organic || row.is_waxed)}
                        {' · '}
                      {/if}
                      {#if row.is_ipm}
                        <span>IPM</span>
                      {/if}
                      {#if row.is_ipm && (row.is_local || row.is_organic || row.is_waxed)}
                        {' · '}
                      {/if}
                      {#if row.is_local}
                        <span class="text-blue-600">Local</span>
                      {/if}
                      {#if row.is_local && (row.is_organic || row.is_waxed)}
                        {' · '}
                      {/if}
                      {#if row.is_organic}
                        <span class="text-green-600">Organic</span>
                      {/if}
                      {#if row.is_organic && row.is_waxed}
                        {' · '}
                      {/if}
                      {#if row.is_waxed}
                        <span>Waxed</span>
                      {/if}
                    </div>

                    {#if row.origin}
                      <div class="text-xs text-zinc-400">{row.origin}</div>
                    {/if}
                  </div>

                </div>
              </td>

              <td class={`relative p-2 text-zinc-900 ${DATA_COL_CLASS} box-border`}>
                <div>
                  <span
                    class={`font-mono font-bold ${
                      prev !== null && row.price < prev
                        ? 'text-green-600'
                        : prev !== null && row.price > prev
                          ? 'text-red-600'
                          : ''
                    }`}
                    >${row.price.toFixed(2)}</span
                  >{#if prev !== null && prev !== row.price}<sup class="ml-1 font-mono text-[0.65em] text-zinc-400 line-through"
                    >${prev.toFixed(2)}</sup
                  >{/if}
                </div>
                <div class="text-xs text-zinc-500 font-mono">/{row.unit}</div>
                <div class="mt-1">
                  <ProduceSparkline
                    points={rowHistory}
                    dateRange={dateRange}
                    timePeriod={timePeriod}
                    unavailableSinceDate={row.unavailable_since_date}
                  />
                </div>
              </td>

              <td class={`relative p-2 ${DATA_COL_CLASS} box-border text-xs tabular-nums`}>
                {#if prev === null || change === null || pct === null}
                  <span class="text-zinc-400">—</span>
                {:else}
                  <div class="flex items-baseline gap-2 rounded bg-transparent px-1">
                    <span class="w-10 shrink-0 text-zinc-500">% Diff</span>
                    <span class={`${METRIC_VALUE_CLASS} ${change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-zinc-500'}`}>
                      {change > 0 ? '+' : change < 0 ? '-' : ''}{Math.abs(pct).toFixed(1)}%
                    </span>
                  </div>
                  <div class="flex items-baseline gap-2 rounded bg-transparent px-1">
                    <span class="w-10 shrink-0 text-zinc-500">$ Diff</span>
                    <span class={`${METRIC_VALUE_CLASS} ${change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-zinc-500'}`}>
                      {change > 0 ? '+' : change < 0 ? '-' : ''}${Math.abs(change).toFixed(2)}
                    </span>
                  </div>
                  <div class={`flex items-baseline gap-2 rounded px-1 ${
                    showHighLow &&
                    periodData.high !== null &&
                    row.price === periodData.high &&
                    row.price !== periodData.low
                      ? 'bg-red-100 text-zinc-900'
                      : 'bg-transparent text-zinc-500'
                  }`}>
                    <span class="w-10 shrink-0">High</span>
                    <span class={METRIC_VALUE_CLASS}>
                      {showHighLow && periodData.high !== null ? `$${periodData.high.toFixed(2)}` : '—'}
                    </span>
                  </div>
                  <div class={`flex items-baseline gap-2 rounded px-1 ${
                    showHighLow && periodData.low !== null && row.price === periodData.low
                      ? 'bg-green-100 text-zinc-900'
                      : 'bg-transparent text-zinc-500'
                  }`}>
                    <span class="w-10 shrink-0">Low</span>
                    <span class={METRIC_VALUE_CLASS}>
                      {showHighLow && periodData.low !== null ? `$${periodData.low.toFixed(2)}` : '—'}
                    </span>
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  {#if contextMenu}
    <ProduceContextMenu
      itemName={contextMenu.itemName}
      x={contextMenu.x}
      y={contextMenu.y}
      isFavorite={favorites.has(contextMenu.itemName)}
      onToggleFavorite={toggleFavorite}
      onClose={closeContextMenu}
    />
  {/if}
</div>
