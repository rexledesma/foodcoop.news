<script lang="ts">
  import { goto } from '$app/navigation';
  import { createWindowVirtualizer } from '@tanstack/svelte-virtual';
  import Fuse from 'fuse.js';
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { get } from 'svelte/store';
  import ProduceSparkline from '@/components/produce/ProduceSparkline.svelte';
  import { produceHash, produceItemUrl } from '@/lib/produce-hash';
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
  type SortField = 'name' | 'price' | 'change' | 'first_seen' | 'last_seen' | 'favorite_count';
  type SortDirection = 'asc' | 'desc' | null;
  type QuickFilter =
    | 'favorites'
    | 'drops'
    | 'increases'
    | 'new'
    | 'recently_unavailable'
    | null;
  type ProduceSearchDocument = {
    id: string;
    name: string;
    origin: string;
    attributes: string;
  };
  type LinkPreviewData = {
    url: string;
    title: string;
    description?: string;
    siteName?: string;
    image?: string;
  };
  type ActionsMenuState = {
    itemName: string;
    url: string | null;
    loading: boolean;
    data: LinkPreviewData | null;
  };
  type FavoriteBurst = {
    id: number;
    x: number;
    y: number;
    emoji: '❤️' | '💔';
    xMid: number;
    yMid: number;
    xEnd: number;
    yEnd: number;
    rotateStart: number;
    rotateEnd: number;
    durationMs: number;
  };
  type ControlsMenu = 'filter' | 'sort' | 'period' | null;
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
    initialQuickFilter: QuickFilter;
    showSticky: boolean;
    favoritesSnapshot: string;
    favoriteCounts: Record<string, number>;
    toggleFavorite: (name: string) => void;
  };

  const TIME_PERIODS: TimePeriod[] = [
    '1D',
    '1W',
    '1M',
    'YTD',
    '1Y',
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
  const PERIOD_MENU_LABELS: Record<TimePeriod, string> = {
    '1D': 'Past day',
    '1W': 'Past week',
    '1M': 'Past month',
    '1Y': 'Past year',
    YTD: 'Year to date',
    '5Y': 'Past 5 years',
    MAX: 'All time',
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
  const FILTER_MENU_OPTIONS: { value: QuickFilter; label: string; className: string; }[] = [
    { value: null, label: 'All', className: 'text-zinc-900' },
    { value: 'favorites', label: 'Favorites', className: 'text-amber-800' },
    { value: 'new', label: 'New Arrivals', className: 'text-[#3F7540]' },
    { value: 'recently_unavailable', label: 'Out of Stock', className: 'text-red-700' },
  ];
  const FILTER_COMPACT_LABELS: Record<Exclude<QuickFilter, null>, string> = {
    favorites: 'Favorites',
    drops: 'Drops',
    increases: 'Hikes',
    new: 'New',
    recently_unavailable: 'Out',
  };
  const SORT_MENU_OPTIONS: {
    label: string;
    shortLabel: string;
    isActive: (field: SortField | null, direction: SortDirection) => boolean;
    apply: () => void;
  }[] = [];
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
  const FAVORITE_BURST_MIN_LIFETIME_MS = 500;
  const FAVORITE_BURST_MAX_LIFETIME_MS = 1000;
  const WINDOW_TRANSITION_MS = 750;

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
  let revalidateForPeriod = $state<(period: ProduceSWRPeriod) => void>(() : void => {});
  let initialDateFilter = $state<string | null>(null);
  let initialItemFilter = $state<string | null>(null);
  let initialProduceFilter = $state<string | null>(null);
  let initialQuickFilter = $state<QuickFilter>(null);
  let showSticky = $state(true);
  let favoritesSnapshot = $state('[]');
  let favoriteCounts = $state<Record<string, number>>({});
  let toggleFavorite = $state<(name: string) => void>(() : void => {});
  let stickyHeaderRef = $state<HTMLDivElement | null>(null);
  let actionsMenu = $state<ActionsMenuState | null>(null);
  let actionsMenuAnchorEl = $state<HTMLElement | null>(null);
  let actionsMenuCopied = $state(false);
  let favoriteBurstLayerRef = $state<HTMLDivElement | null>(null);
  let virtualRowsAnchorRef = $state<HTMLDivElement | null>(null);
  let openControlsMenu = $state<ControlsMenu>(null);
  let favoriteBursts = $state<FavoriteBurst[]>([]);
  let nextFavoriteBurstId = $state(0);
  let virtualScrollMargin = $state(0);
  let actionsMenuCopyTimeout = 0;
  let actionsMenuRequestToken = $state(0);
  const actionsMenuPreviewCache = new Map<string, LinkPreviewData>();
  const actionsMenuPreviewRequests = new Map<string, Promise<LinkPreviewData>>();
  const VIRTUAL_ROW_ESTIMATE = 140;
  const VIRTUAL_ROW_BUFFER = 50;
  const VIRTUAL_ROW_CHUNK = 50;
  const DEFAULT_QUICK_FILTER: QuickFilter = null;
  const DEFAULT_TIME_PERIOD: TimePeriod = '1M';
  const DEFAULT_SORT_FIELD: SortField = 'change';
  const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';

  SORT_MENU_OPTIONS.push(
    {
      label: 'Name: A-Z',
      shortLabel: 'A-Z',
      isActive: (field, direction) => field === 'name' && direction === 'asc',
      apply: () : void => applySortSelection('name', 'asc'),
    },
    {
      label: 'Name: Z-A',
      shortLabel: 'Z-A',
      isActive: (field, direction) => field === 'name' && direction === 'desc',
      apply: () : void => applySortSelection('name', 'desc'),
    },
    {
      label: 'Favorites: Popular',
      shortLabel: 'Popular',
      isActive: (field, direction) => field === 'favorite_count' && direction === 'desc',
      apply: () : void => applySortSelection('favorite_count', 'desc'),
    },
    {
      label: 'Price: Low to High ($-$$)',
      shortLabel: '$-$$',
      isActive: (field, direction) => field === 'price' && direction === 'asc',
      apply: () : void => applySortSelection('price', 'asc'),
    },
    {
      label: 'Price: High to Low ($$-$)',
      shortLabel: '$$-$',
      isActive: (field, direction) => field === 'price' && direction === 'desc',
      apply: () : void => applySortSelection('price', 'desc'),
    },
    {
      label: 'Trends: Price Drops',
      shortLabel: 'Drops',
      isActive: (field, direction) => field === 'change' && direction === 'asc',
      apply: () : void => applySortSelection('change', 'asc'),
    },
    {
      label: 'Trends: Price Hikes',
      shortLabel: 'Hikes',
      isActive: (field, direction) => field === 'change' && direction === 'desc',
      apply: () : void => applySortSelection('change', 'desc'),
    },
  );

  // Render rows in chunked windows with one extra chunk on both sides to avoid
  // boundary thrash when scrolling in either direction.
  function extractVirtualRowRange(range: {
    startIndex: number;
    endIndex: number;
    overscan: number;
    count: number;
  }): number[] {
    if (range.count <= 0) {return [];}
    const overscannedStart = Math.max(0, range.startIndex - range.overscan);
    const overscannedEnd = Math.min(range.count - 1, range.endIndex + range.overscan);
    const snappedStart = Math.max(
      0,
      Math.floor(overscannedStart / VIRTUAL_ROW_CHUNK) * VIRTUAL_ROW_CHUNK - VIRTUAL_ROW_CHUNK,
    );
    const snappedEnd = Math.min(
      range.count - 1,
      Math.ceil((overscannedEnd + 1) / VIRTUAL_ROW_CHUNK) * VIRTUAL_ROW_CHUNK +
        VIRTUAL_ROW_CHUNK -
        1,
    );
    return Array.from({ length: snappedEnd - snappedStart + 1 }, (_, i) : number => snappedStart + i);
  }

  const rowVirtualizer = createWindowVirtualizer<HTMLTableRowElement>({
    count: 0,
    estimateSize: () : number => VIRTUAL_ROW_ESTIMATE,
    overscan: VIRTUAL_ROW_BUFFER,
    rangeExtractor: extractVirtualRowRange,
    getItemKey: (index) : number => index,
  });

  let search = $state('');
  let quickFilter = $state<QuickFilter>(DEFAULT_QUICK_FILTER);
  let timePeriod = $state<TimePeriod>(DEFAULT_TIME_PERIOD);
  let statsFromPeriod = $state<TimePeriod | null>(null);
  let statsTransitionProgress = $state(1);
  let lastStatsPeriod: TimePeriod | null = null;
  let statsTransitionRaf = 0;
  let sortField = $state<SortField | null>(DEFAULT_SORT_FIELD);
  let sortDirection = $state<SortDirection>(DEFAULT_SORT_DIRECTION);
  let dateFilter = $state<string | null>(null);
  let itemFilter = $state<string | null>(null);
  let lastAppliedInitialQuerySignature = $state<string | null>(null);

  const favorites = $derived(parseFavorites(favoritesSnapshot));
  const stickyVisible = $derived(showSticky);
  const normalizedSearch = $derived(search.trim().toLowerCase());
  const hasSearchQuery = $derived(normalizedSearch.length > 0);
  const periodScopedRows = $derived.by(() : ProduceRow[] => {
    return data.filter((row) : boolean => hasPointInPeriod(history.get(row.name), dateRange, timePeriod));
  });

  const searchDocs = $derived(
    periodScopedRows.map<ProduceSearchDocument>((row) : { id: string; name: string; origin: string; attributes: string; } => ({
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

  const searchScores = $derived.by(() : Map<string, number> | null => {
    if (!hasSearchQuery) {return null;}
    const hits = produceFuse.search(normalizedSearch);
    return new Map(hits.map((hit) : [string, number] => [hit.item.id, hit.score ?? Number.MAX_VALUE]));
  });

  function rowMatchesDateFilter(row: ProduceRow, targetDate: string): boolean {
    const arrivedOnDate = row.is_new && row.first_seen_date === targetDate;
    const becameUnavailableOnDate =
      row.is_unavailable && row.unavailable_since_date === targetDate;
    return arrivedOnDate || becameUnavailableOnDate;
  }

  const filteredRows = $derived.by(() : ProduceRow[] => {
    let result = periodScopedRows;

    if (itemFilter) {
      result = result.filter((row) : boolean => produceHash(row.name) === itemFilter);
    }

    const selectedDate = dateFilter;
    if (selectedDate) {
      result = result.filter((row) : boolean => rowMatchesDateFilter(row, selectedDate));
    }

    if (searchScores) {
      result = result.filter((row) : boolean => searchScores.has(produceHash(row.name)));
    }

    if (quickFilter === 'favorites') {
      result = result.filter((row) : boolean => favorites.has(row.name));
    } else if (quickFilter === 'new') {
      result = result.filter((row) : boolean => row.is_new);
    } else if (quickFilter === 'recently_unavailable') {
      result = result.filter((row) : boolean => row.is_unavailable);
    }

    if (searchScores && (!sortField || !sortDirection)) {
      return [...result].sort((a, b) : number => {
        const aScore = searchScores.get(produceHash(a.name)) ?? Number.MAX_VALUE;
        const bScore = searchScores.get(produceHash(b.name)) ?? Number.MAX_VALUE;
        return aScore - bScore;
      });
    }

    if (sortField === 'favorite_count') {
      return [...result].sort((a, b) : number => {
        const countDelta = favoriteCount(b.name) - favoriteCount(a.name);
        if (countDelta !== 0) {return countDelta;}
        return a.name.localeCompare(b.name);
      });
    }

    if (!sortField || !sortDirection) {
      return result;
    }

    return [...result].sort((a, b) : number => {
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
      if (sortField === 'favorite_count') {
        const countDelta = favoriteCount(a.name) - favoriteCount(b.name);
        return sortDirection === 'asc' ? countDelta : -countDelta;
      }

      const aPrev = getPreviousPrice(a, timePeriod, history.get(a.name), dateRange, false);
      const bPrev = getPreviousPrice(b, timePeriod, history.get(b.name), dateRange, false);
      const aChange = aPrev !== null && aPrev !== 0 ? (a.price - aPrev) / aPrev : 0;
      const bChange = bPrev !== null && bPrev !== 0 ? (b.price - bPrev) / bPrev : 0;
      return sortDirection === 'asc' ? aChange - bChange : bChange - aChange;
    });
  });

  const fullSearchMatchCount = $derived.by(() : number => {
    if (!searchScores) {return periodScopedRows.length;}
    return periodScopedRows.filter((row) : boolean => searchScores.has(produceHash(row.name))).length;
  });

  const hasActiveResultFilter = $derived.by(() : boolean => {
    if (itemFilter || dateFilter) {return true;}
    return (
      quickFilter === 'favorites' ||
      quickFilter === 'new' ||
      quickFilter === 'recently_unavailable'
    );
  });

  const shouldShowClearFilterSearchCta = $derived.by(() : boolean => {
    return (
      filteredRows.length === 0 &&
      hasSearchQuery &&
      hasActiveResultFilter &&
      fullSearchMatchCount > 0
    );
  });

  const quickFilterCount = $derived.by(() : number => {
    let base = periodScopedRows;
    const selectedDate = dateFilter;
    if (selectedDate) {
      base = base.filter((row) : boolean => rowMatchesDateFilter(row, selectedDate));
    }
    if (!quickFilter || quickFilter === 'drops' || quickFilter === 'increases') {
      return base.length;
    }
    if (quickFilter === 'favorites') {
      return base.filter((row) : boolean => favorites.has(row.name)).length;
    }
    if (quickFilter === 'new') {
      return base.filter((row) : boolean => row.is_new).length;
    }
    return base.filter((row) : boolean => row.is_unavailable).length;
  });

  const itemFilterName = $derived.by(() : string | null => {
    if (!itemFilter) {return null;}
    return periodScopedRows.find((row) : boolean => produceHash(row.name) === itemFilter)?.name ?? null;
  });
  const virtualRows = $derived($rowVirtualizer.getVirtualItems());
  const visibleVirtualRows = $derived.by(() : any =>
    virtualRows
      .map((virtualRow) : { virtualRow: any; row: ProduceRow; } | null => {
        const row = filteredRows[virtualRow.index];
        return row ? { virtualRow, row } : null;
      })
      .filter((entry) : boolean => entry !== null),
  );
  const virtualTotalSize = $derived(Math.max(0, $rowVirtualizer.getTotalSize() - virtualScrollMargin));
  const virtualPaddingTop = $derived.by(() : number => {
    if (virtualRows.length === 0) {return 0;}
    return Math.max(0, virtualRows[0].start - virtualScrollMargin);
  });
  const virtualPaddingBottom = $derived.by(() : number => {
    if (virtualRows.length === 0) {return 0;}
    const lastItem = virtualRows[virtualRows.length - 1];
    const adjustedLastEnd = Math.max(0, lastItem.end - virtualScrollMargin);
    return Math.max(0, virtualTotalSize - adjustedLastEnd);
  });
  const produceFilterDisplayName = $derived.by(() : string | null => {
    if (itemFilterName) {return itemFilterName;}
    if (!initialProduceFilter) {return null;}
    const decoded = decodeMaybe(initialProduceFilter).trim();
    if (!decoded) {return null;}
    const byHash = data.find((row) : boolean => produceHash(row.name).toLowerCase() === decoded.toLowerCase());
    if (byHash) {return byHash.name;}
    return decoded;
  });

  function parseFavorites(stored: string): Set<string> {
    if (!stored) {return new Set();}
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
    if (!produceParam) {return null;}
    const decoded = decodeMaybe(produceParam).trim();
    if (!decoded) {return null;}

    const byHash = data.find(
      (row) : boolean => produceHash(row.name).toLowerCase() === decoded.toLowerCase(),
    );
    if (byHash) {return produceHash(byHash.name);}

    const byName = data.find((row) : boolean => row.name.toLowerCase() === decoded.toLowerCase());
    if (byName) {return produceHash(byName.name);}

    return null;
  }

  function getProduceAttributeTerms(row: ProduceRow): string {
    const terms: string[] = [];
    if (row.is_organic) {terms.push('organic');}
    if (row.is_local) {terms.push('local');}
    if (row.is_ipm) {terms.push('ipm');}
    if (row.is_hydroponic) {terms.push('hydroponic');}
    if (row.is_waxed) {terms.push('waxed');}
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

  function getAnimatedPeriodStartMs(period: TimePeriod, endMs: number): number {
    const targetStart = getPeriodStartMs(period, endMs);
    if (!statsFromPeriod || statsTransitionProgress >= 1) {return targetStart;}
    const sourceStart = getPeriodStartMs(statsFromPeriod, endMs);
    return sourceStart + (targetStart - sourceStart) * statsTransitionProgress;
  }

  const shouldScrubStats = $derived(statsFromPeriod !== null && statsTransitionProgress < 1);

  $effect(() : (() => void) | undefined => {
    if (lastStatsPeriod === null) {
      lastStatsPeriod = timePeriod;
      statsFromPeriod = null;
      statsTransitionProgress = 1;
      return;
    }
    if (timePeriod === lastStatsPeriod) {return;}

    cancelAnimationFrame(statsTransitionRaf);
    statsFromPeriod = lastStatsPeriod;
    statsTransitionProgress = 0;
    lastStatsPeriod = timePeriod;
    const start = performance.now();

    const animate = (now: number) : void => {
      const t = Math.min((now - start) / WINDOW_TRANSITION_MS, 1);
      statsTransitionProgress = (1 - Math.cos(t * Math.PI)) / 2;
      if (t < 1) {
        statsTransitionRaf = requestAnimationFrame(animate);
        return;
      }
      statsFromPeriod = null;
      statsTransitionProgress = 1;
      statsTransitionRaf = 0;
    };

    statsTransitionRaf = requestAnimationFrame(animate);
    return () : void => {
      cancelAnimationFrame(statsTransitionRaf);
      statsTransitionRaf = 0;
    };
  });

  function historyPrev(
    points: ProduceHistoryPoint[] | undefined,
    activeRange: ProduceDateRange | null,
    period: TimePeriod,
    useAnimatedStart = true,
  ): number | null {
    if (!points || points.length === 0) {return null;}
    const endMs = activeRange
      ? new Date(activeRange.end + 'T00:00:00').getTime()
      : new Date(points[points.length - 1].date + 'T00:00:00').getTime();
    const startMs = useAnimatedStart
      ? getAnimatedPeriodStartMs(period, endMs)
      : getPeriodStartMs(period, endMs);

    let prev: number | null = null;
    let closest = Number.POSITIVE_INFINITY;
    for (const point of points) {
      const ms = new Date(point.date + 'T00:00:00').getTime();
      if (ms > endMs) {continue;}
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
    useAnimatedStart = true,
  ): number | null {
    if (useAnimatedStart && shouldScrubStats) {
      return historyPrev(points, activeRange, period, true);
    }
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
        return historyPrev(points, activeRange, period, useAnimatedStart);
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
    if (!shouldScrubStats) {
      if (period === '1D')
        {return { prev: row.prev_day_price, high: row.day_high, low: row.day_low };}
      if (period === '1W')
        {return { prev: row.prev_week_price, high: row.week_high, low: row.week_low };}
      if (period === '1M')
        {return { prev: row.prev_month_price, high: row.month_high, low: row.month_low };}
      if (period === '1Y')
        {return { prev: row.prev_year_price, high: row.year_high, low: row.year_low };}
      if (period === 'YTD')
        {return { prev: row.prev_ytd_price, high: row.ytd_high, low: row.ytd_low };}
    }

    if (!points || points.length === 0) {
      return { prev: null, high: null, low: null };
    }

    const endMs = activeRange
      ? new Date(activeRange.end + 'T00:00:00').getTime()
      : new Date(points[points.length - 1].date + 'T00:00:00').getTime();
    const periodStartMs = getAnimatedPeriodStartMs(period, endMs);
    let prev: number | null = null;
    let closestPrevDist = Number.POSITIVE_INFINITY;
    let high: number | null = null;
    let low: number | null = null;

    for (const point of points) {
      const pointMs = new Date(point.date + 'T00:00:00').getTime();
      if (pointMs > endMs) {continue;}

      const prevDist = Math.abs(pointMs - periodStartMs);
      if (prevDist < closestPrevDist) {
        closestPrevDist = prevDist;
        prev = point.price;
      }

      if (pointMs < periodStartMs) {continue;}
      if (high === null || point.price > high) {high = point.price;}
      if (low === null || point.price < low) {low = point.price;}
    }

    return { prev, high, low };
  }

  function getPeriodPointCount(
    points: ProduceHistoryPoint[] | undefined,
    activeRange: ProduceDateRange | null,
    period: TimePeriod,
  ): number {
    if (!points || points.length === 0) {return 0;}
    const endMs = activeRange
      ? new Date(activeRange.end + 'T00:00:00').getTime()
      : new Date(points[points.length - 1].date + 'T00:00:00').getTime();
    const periodStartMs = getAnimatedPeriodStartMs(period, endMs);
    return points.filter((point) : boolean => {
      const pointMs = new Date(point.date + 'T00:00:00').getTime();
      return pointMs >= periodStartMs && pointMs <= endMs;
    }).length;
  }

  function hasPointInPeriod(
    points: ProduceHistoryPoint[] | undefined,
    activeRange: ProduceDateRange | null,
    period: TimePeriod,
  ): boolean {
    if (!points || points.length === 0) {return false;}
    const endMs = activeRange
      ? new Date(activeRange.end + 'T00:00:00').getTime()
      : new Date(points[points.length - 1].date + 'T00:00:00').getTime();
    const periodStartMs = getPeriodStartMs(period, endMs);
    for (const point of points) {
      const pointMs = new Date(point.date + 'T00:00:00').getTime();
      if (pointMs >= periodStartMs && pointMs <= endMs) {
        return true;
      }
    }
    return false;
  }

  function metricLabel(period: TimePeriod): string {
    return PERIOD_METRIC_LABELS[period];
  }

  function quickFilterPillLabel(filter: QuickFilter): string {
    if (filter === 'favorites') {return 'Favorites';}
    if (filter === 'new') {return 'New Arrivals';}
    if (filter === 'recently_unavailable') {return 'Out of Stock';}
    return 'Filter';
  }

  function quickFilterPillClass(filter: QuickFilter): string {
    if (filter === 'favorites') {return 'bg-amber-100 text-amber-800';}
    if (filter === 'new') {return 'bg-[rgb(255,246,220)] text-[#3F7540]';}
    if (filter === 'recently_unavailable') {return 'bg-red-100 text-red-700';}
    return 'bg-zinc-100 text-zinc-700';
  }

  function activeViewFilter():
    | 'favorites'
    | 'new'
    | 'recently_unavailable'
    | 'date'
    | null {
    if (dateFilter) {return 'date';}
    if (quickFilter === 'favorites') {return 'favorites';}
    if (quickFilter === 'new') {return 'new';}
    if (quickFilter === 'recently_unavailable') {return 'recently_unavailable';}
    return null;
  }

  function activeFilterPillLabel(): string {
    const filter = activeViewFilter();
    if (filter === 'date' && dateFilter) {return formatShortDate(dateFilter);}
    if (filter === 'date') {return 'All';}
    return filter ? FILTER_COMPACT_LABELS[filter] : 'All';
  }

  function activeFilterPillClass(): string {
    const filter = activeViewFilter();
    if (filter === 'date') {return 'bg-blue-100 text-blue-800';}
    return filter ? quickFilterPillClass(filter) : 'bg-zinc-900 text-white';
  }

  function shouldShowViewFilterPill(): boolean {
    if (produceFilterDisplayName) {return false;}
    return true;
  }

  function activeResultFilterLabel(): string {
    if (produceFilterDisplayName) {return produceFilterDisplayName;}
    const filter = activeViewFilter();
    if (filter === 'date' && dateFilter) {return formatShortDate(dateFilter).toLowerCase();}
    if (
      filter === 'favorites' ||
      filter === 'new' ||
      filter === 'recently_unavailable'
    ) {
      return quickFilterPillLabel(filter).toLowerCase();
    }
    return 'current filter';
  }

  function clearActiveResultFilter() : void {
    if (dateFilter) {
      clearDateFilter();
      return;
    }
    if (itemFilter || initialProduceFilter) {
      clearItemFilter();
      return;
    }
    clearQuickFilter();
  }

  function clearSearchQuery() : void {
    search = '';
  }

  function clearQuickFilter() : void {
    quickFilter = DEFAULT_QUICK_FILTER;
    sortField = DEFAULT_SORT_FIELD;
    sortDirection = DEFAULT_SORT_DIRECTION;
  }

  function formatShortDate(isoDate: string): string {
    const date = new Date(isoDate + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  }

  function formatOutOfStockDate(isoDate: string): string {
    const date = new Date(isoDate + 'T12:00:00');
    const shouldIncludeYear = date.getFullYear() < new Date().getFullYear();
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      ...(shouldIncludeYear ? { year: 'numeric' } : {}),
    });
  }

  function clearDateFilter() : void {
    dateFilter = null;
    const url = new URL(window.location.href);
    url.searchParams.delete('date');
    void goto(url.pathname + url.search, { keepFocus: true, noScroll: true, replaceState: true });
  }

  function clearQueryFilters() : void {
    dateFilter = null;
    itemFilter = null;
    initialProduceFilter = null;
    const url = new URL(window.location.href);
    url.searchParams.delete('filter');
    url.searchParams.delete('date');
    url.searchParams.delete('item');
    url.searchParams.delete('produce');
    url.searchParams.delete('name');
    void goto(url.pathname + url.search, { keepFocus: true, noScroll: true, replaceState: true });
  }

  function clearItemFilter() : void {
    itemFilter = null;
    initialProduceFilter = null;
    const url = new URL(window.location.href);
    url.searchParams.delete('filter');
    url.searchParams.delete('item');
    url.searchParams.delete('produce');
    url.searchParams.delete('name');
    void goto(url.pathname + url.search, { keepFocus: true, noScroll: true, replaceState: true });
  }

  function clearActionsMenuCopyFeedback() : void {
    if (actionsMenuCopyTimeout === 0) {return;}
    window.clearTimeout(actionsMenuCopyTimeout);
    actionsMenuCopyTimeout = 0;
  }

  function hideActionsMenu() : void {
    actionsMenu = null;
    actionsMenuAnchorEl = null;
    actionsMenuCopied = false;
    clearActionsMenuCopyFeedback();
  }

  function toggleControlsMenu(menu: Exclude<ControlsMenu, null>) : void {
    openControlsMenu = openControlsMenu === menu ? null : menu;
  }

  function hideControlsMenu() : void {
    openControlsMenu = null;
  }

  function applyQuickFilter(nextFilter: QuickFilter) : void {
    clearQueryFilters();
    quickFilter = nextFilter;
    hideControlsMenu();
  }

  function applySortSelection(nextField: SortField, nextDirection: Exclude<SortDirection, null>) : void {
    clearQueryFilters();
    sortField = nextField;
    sortDirection = nextDirection;
    hideControlsMenu();
  }

  function activeSortLabel() : string {
    const activeOption = SORT_MENU_OPTIONS.find((option) => option.isActive(sortField, sortDirection));
    if (activeOption) {return activeOption.shortLabel;}
    return 'A-Z';
  }

  function activeSortPillClass() : string {
    if (sortField === 'favorite_count' && sortDirection === 'desc') {return 'bg-amber-100 text-amber-800';}
    if (sortField === 'change' && sortDirection === 'asc') {return 'bg-green-100 text-green-700';}
    if (sortField === 'change' && sortDirection === 'desc') {return 'bg-red-100 text-red-700';}
    return 'bg-zinc-100 text-zinc-700';
  }

  function activePeriodPillClass() : string {
    return 'bg-blue-100 text-blue-800';
  }

  function sortOptionPillClass(label: string) : string {
    if (label === 'Favorites: Popular') {return 'bg-amber-100 text-amber-800';}
    if (label === 'Trends: Price Drops') {return 'bg-green-100 text-green-700';}
    if (label === 'Trends: Price Hikes') {return 'bg-red-100 text-red-700';}
    return 'bg-zinc-100 text-zinc-700';
  }

  function periodOptionPillClass(period: TimePeriod) : string {
    return 'bg-blue-100 text-blue-800';
  }

  function filterOptionPillClass(filter: QuickFilter) : string {
    if (filter === null) {return 'bg-zinc-100 text-zinc-700';}
    return quickFilterPillClass(filter);
  }

  async function requestLinkPreview(url: string): Promise<LinkPreviewData> {
    const cached = actionsMenuPreviewCache.get(url);
    if (cached) {return cached;}

    const pending = actionsMenuPreviewRequests.get(url);
    if (pending) {return pending;}

    const request = (async () : Promise<LinkPreviewData> => {
      const response = await fetch(`/api/produce/link-preview?url=${encodeURIComponent(url)}`);
      if (!response.ok) {throw new Error(`HTTP ${response.status}`);}
      const payload = (await response.json()) as LinkPreviewData;
      actionsMenuPreviewCache.set(url, payload);
      return payload;
    })();

    actionsMenuPreviewRequests.set(url, request);
    try {
      return await request;
    } finally {
      if (actionsMenuPreviewRequests.get(url) === request) {
        actionsMenuPreviewRequests.delete(url);
      }
    }
  }

  async function loadActionsMenuPreview(
    itemName: string,
    specialtyUrl: string | null,
  ) : Promise<void> {
    const currentToken = ++actionsMenuRequestToken;
    actionsMenu = {
      itemName,
      url: specialtyUrl,
      loading: specialtyUrl !== null,
      data: null,
    };

    if (!specialtyUrl) {return;}

    try {
      const payload = await requestLinkPreview(specialtyUrl);
      if (currentToken !== actionsMenuRequestToken) {return;}
      actionsMenu = {
        itemName,
        url: specialtyUrl,
        loading: false,
        data: payload,
      };
    } catch {
      if (currentToken !== actionsMenuRequestToken) {return;}
      actionsMenu = {
        itemName,
        url: specialtyUrl,
        loading: false,
        data: null,
      };
    }
  }

  function openActionsMenu(
    itemName: string,
    specialtyUrl: string | null,
    anchorEl: HTMLElement,
  ) : void {
    clearActionsMenuCopyFeedback();
    actionsMenuCopied = false;
    actionsMenuAnchorEl = anchorEl;
    void loadActionsMenuPreview(itemName, specialtyUrl);
  }

  function handleRowActionsButtonClick(
    event: MouseEvent,
    rowName: string,
    specialtyUrl: string | null,
  ) : void {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    if (!(button instanceof HTMLElement)) {return;}
    if (actionsMenu?.itemName === rowName && actionsMenuAnchorEl === button) {
      hideActionsMenu();
      return;
    }
    openActionsMenu(rowName, specialtyUrl, button);
  }

  async function handleActionsMenuShare() : Promise<void> {
    if (!actionsMenu) {return;}
    const url = `${window.location.origin}${produceItemUrl(actionsMenu.itemName)}`;
    const shareData = { title: actionsMenu.itemName, url };

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Ignore share cancellations.
      }
    }

    await navigator.clipboard.writeText(url);
    actionsMenuCopied = true;
    clearActionsMenuCopyFeedback();
    actionsMenuCopyTimeout = window.setTimeout(() : void => {
      actionsMenuCopyTimeout = 0;
      actionsMenuCopied = false;
    }, 1600);
  }

  function randomInRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function resolveBurstOrigin(
    rowElement: HTMLTableRowElement,
    originX?: number,
    originY?: number,
  ): { x: number; y: number } {
    const rowRect = rowElement.getBoundingClientRect();
    const layerRect = favoriteBurstLayerRef?.getBoundingClientRect();
    const layerOffsetX = layerRect?.left ?? 0;
    const layerOffsetY = layerRect?.top ?? 0;
    const rowLeft = rowRect.left - layerOffsetX;
    const rowRight = rowRect.right - layerOffsetX;
    const rowTop = rowRect.top - layerOffsetY;
    const rowBottom = rowRect.bottom - layerOffsetY;

    if (typeof originX !== 'number' || typeof originY !== 'number') {
      return {
        x: rowLeft + rowRect.width / 2,
        y: rowTop + rowRect.height / 2,
      };
    }

    const localX = originX - layerOffsetX;
    const localY = originY - layerOffsetY;
    const x = Math.min(Math.max(localX, rowLeft), rowRight);
    const y = Math.min(Math.max(localY, rowTop), rowBottom);
    return { x, y };
  }

  function createFavoriteBurstFromRow(
    rowElement: HTMLTableRowElement,
    emoji: '❤️' | '💔',
    originX?: number,
    originY?: number,
  ) : void {
    const origin = resolveBurstOrigin(rowElement, originX, originY);
    const angle = randomInRange(210, 330) * (Math.PI / 180);
    const launchDistance = randomInRange(34, 78);
    const endDistance = launchDistance + randomInRange(52, 110);
    const xMid = Math.cos(angle) * launchDistance;
    const yMid = Math.sin(angle) * launchDistance;
    const xEnd = Math.cos(angle) * endDistance + randomInRange(-22, 22);
    const yEnd = Math.abs(yMid) + randomInRange(18, 54);
    const durationMs = Math.round(
      randomInRange(FAVORITE_BURST_MIN_LIFETIME_MS, FAVORITE_BURST_MAX_LIFETIME_MS),
    );
    const burst = {
      id: ++nextFavoriteBurstId,
      x: origin.x,
      y: origin.y,
      emoji,
      xMid,
      yMid,
      xEnd,
      yEnd,
      rotateStart: randomInRange(-35, 35),
      rotateEnd: randomInRange(-220, 220),
      durationMs,
    };
    favoriteBursts = [...favoriteBursts, burst];
  }

  function removeFavoriteBurst(id: number) : void {
    favoriteBursts = favoriteBursts.filter((item) : boolean => item.id !== id);
  }

  function toggleFavoriteWithBurst(
    rowName: string,
    rowElement: HTMLTableRowElement,
    originX?: number,
    originY?: number,
  ) : void {
    const wasFavorite = favorites.has(rowName);
    toggleFavorite(rowName);
    createFavoriteBurstFromRow(rowElement, wasFavorite ? '💔' : '❤️', originX, originY);
  }

  function handleRowFavoriteButtonClick(event: MouseEvent, rowName: string) : void {
    event.preventDefault();
    const button = event.currentTarget;
    if (!(button instanceof HTMLElement)) {return;}
    const rowElement = button.closest('tr');
    if (!(rowElement instanceof HTMLTableRowElement)) {
      toggleFavorite(rowName);
      return;
    }
    const rect = button.getBoundingClientRect();
    toggleFavoriteWithBurst(
      rowName,
      rowElement,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
  }

  function updateVirtualScrollMargin() : void {
    if (typeof window === 'undefined') {return;}
    const anchor = virtualRowsAnchorRef;
    if (!anchor) {return;}
    virtualScrollMargin = anchor.getBoundingClientRect().top + window.scrollY;
  }

  function measureVirtualRow(
    node: HTMLTableRowElement,
    _index: number,
  ): { update: (nextIndex: number) => void } {
    const virtualizer = get(rowVirtualizer);
    virtualizer.measureElement(node);
    return {
      update(_nextIndex: number) : void {
        virtualizer.measureElement(node);
      },
    };
  }

  function handleSort(field: SortField) : void {
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
    if (sortField !== field || sortDirection === null) {return '';}
    return sortDirection === 'asc' ? '↑' : '↓';
  }

  function favoriteCount(name: string): number {
    return favoriteCounts[name] ?? 0;
  }

  function applyState(next: ProduceAnalyticsClientState) : void {
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
    initialQuickFilter = next.initialQuickFilter;
    showSticky = next.showSticky;
    favoritesSnapshot = next.favoritesSnapshot;
    favoriteCounts = next.favoriteCounts;
    toggleFavorite = next.toggleFavorite;
  }

  function applyInitialQueryFilters(): boolean {
    const querySignature = JSON.stringify({
      date: initialDateFilter,
      item: initialItemFilter,
      produce: initialProduceFilter,
      filter: initialQuickFilter,
    });
    if (querySignature === lastAppliedInitialQuerySignature) {return false;}
    lastAppliedInitialQuerySignature = querySignature;

    if (!(initialItemFilter || initialProduceFilter || initialDateFilter || initialQuickFilter)) {
      return false;
    }

    quickFilter =
      initialQuickFilter === 'favorites' ||
      initialQuickFilter === 'new' ||
      initialQuickFilter === 'recently_unavailable'
        ? initialQuickFilter
        : null;
    dateFilter = initialDateFilter;
    itemFilter = initialItemFilter ?? null;
    if (initialDateFilter) {
      timePeriod = '1M';
    }
    if (!itemFilter && initialProduceFilter) {
      const isHashParam = /^[a-f0-9]{7}$/i.test(initialProduceFilter.trim());
      itemFilter = isHashParam ? initialProduceFilter.trim().toLowerCase() : null;
    }
    if (initialDateFilter) {
      sortField = null;
      sortDirection = null;
    } else {
      sortField = 'name';
      sortDirection = 'asc';
    }
    return true;
  }

  function handleStateUpdate(event: Event) : void {
    if (!(event instanceof CustomEvent)) {return;}
    applyState(event.detail as ProduceAnalyticsClientState);
    applyInitialQueryFilters();
  }

  $effect(() : void => {
    const swrPeriod: ProduceSWRPeriod | null =
      timePeriod === 'MAX'
        ? 'SINCE_2013'
        : timePeriod === '1Y' || timePeriod === '5Y' || timePeriod === 'YTD'
          ? timePeriod
          : null;
    if (swrPeriod && SWR_PERIODS.has(swrPeriod)) {revalidateForPeriod(swrPeriod);}
  });

  $effect(() : void => {
    get(rowVirtualizer).setOptions({
      count: filteredRows.length,
      estimateSize: () : number => VIRTUAL_ROW_ESTIMATE,
      overscan: VIRTUAL_ROW_BUFFER,
      rangeExtractor: extractVirtualRowRange,
      scrollMargin: virtualScrollMargin,
      getItemKey: (index) : string => filteredRows[index]?.name ?? index,
    });
  });

  $effect(() : (() => void) | undefined => {
    if (typeof window === 'undefined') {return;}
    void virtualRowsAnchorRef;
    void filteredRows.length;
    void timePeriod;
    const raf = window.requestAnimationFrame(() : void => {
      updateVirtualScrollMargin();
      get(rowVirtualizer).measure();
    });
    return () : void => window.cancelAnimationFrame(raf);
  });

  $effect(() : void => {
    localStorage.setItem(
      'produce-filters',
      JSON.stringify({ quickFilter, timePeriod, sortField, sortDirection }),
    );
  });

  onMount(() : () => void => {
    applyState(initialState);
    const didApplyInitialQueryFilters = applyInitialQueryFilters();

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

    const handler = (event: Event) : void => handleStateUpdate(event);
    window.addEventListener(`produce-analytics-state:update:${channel}`, handler as EventListener);
    const handlePointerDown = (event: MouseEvent | TouchEvent) : void => {
      const target = event.target;
      if (!(target instanceof Element)) {return;}
      if (actionsMenu) {
        if (
          target.closest('[data-produce-actions-menu="true"]') ||
          target.closest('[data-produce-actions-trigger="true"]')
        ) {
          return;
        }
        hideActionsMenu();
      }
      if (!openControlsMenu) {return;}
      if (
        target.closest('[data-produce-controls-menu="true"]') ||
        target.closest('[data-produce-controls-trigger="true"]')
      ) {
        return;
      }
      hideControlsMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) : void => {
      if (event.key !== 'Escape') {return;}
      hideActionsMenu();
      hideControlsMenu();
    };
    const handleViewportChange = () : void => {
      updateVirtualScrollMargin();
      if (!actionsMenuAnchorEl?.isConnected) {
        hideActionsMenu();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () : void => {
      window.removeEventListener(`produce-analytics-state:update:${channel}`, handler as EventListener);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
      favoriteBursts = [];
      hideActionsMenu();
      hideControlsMenu();
    };
  });

  $effect(() : void => {
    if (!itemFilter && initialProduceFilter && data.length > 0) {
      const resolved = resolveProduceFilterToHash(initialProduceFilter);
      if (resolved) {
        itemFilter = resolved;
      }
    }
  });

  $effect(() : (() => void) | undefined => {
    const element = stickyHeaderRef;
    if (!element || typeof ResizeObserver === 'undefined') {return;}

    const updateHeight = () : void => {
      window.dispatchEvent(new CustomEvent('sticky-threshold', { detail: element.offsetHeight }));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);

    return () : void => observer.disconnect();
  });
</script>

<div class="mx-auto max-w-3xl px-4 pb-6">
  <div
    bind:this={stickyHeaderRef}
    class={`sticky top-[5.5rem] z-20 bg-white transition-opacity duration-250 ease-in-out motion-reduce:transition-none ${
      stickyVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
    }`}
  >
    <h1 class="py-6 text-2xl font-bold text-zinc-900">Produce</h1>

    <div class="mb-4">
      <div
        class="flex w-full max-w-2xl flex-col gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2"
      >
        <div class="grid w-full grid-cols-3 gap-2 text-sm font-medium text-zinc-900 sm:flex sm:flex-wrap sm:items-center">
          <div class="relative">
            <button
              type="button"
              onclick={() => toggleControlsMenu('filter')}
              aria-expanded={openControlsMenu === 'filter'}
              data-produce-controls-trigger="true"
              class={`inline-flex w-full items-center justify-between gap-1 rounded-full px-2.5 py-1 text-sm font-medium transition-colors sm:w-auto sm:justify-start ${activeFilterPillClass()}`}
            >
              <span>{activeFilterPillLabel()}</span>
              <span aria-hidden="true" class="text-[10px] text-zinc-500">▼</span>
            </button>

            {#if openControlsMenu === 'filter'}
              <div
                class="absolute top-full left-0 z-40 mt-2 w-[min(14rem,calc(100vw-2.5rem))] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white py-1 shadow-[0_16px_50px_-24px_rgba(0,0,0,0.45)] sm:right-0 sm:left-auto sm:w-44 sm:max-w-none"
                data-produce-controls-menu="true"
              >
                <div class="px-4 py-2 text-xs font-semibold tracking-[0.08em] text-zinc-500 uppercase">
                  Filter by
                </div>
                {#each FILTER_MENU_OPTIONS as option (option.label)}
                  <button
                    type="button"
                    onclick={() => applyQuickFilter(option.value)}
                    class="flex w-full items-center justify-between px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-50"
                  >
                    <span
                      class={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${
                        activeViewFilter() === option.value || (option.value === null && !activeViewFilter())
                          ? activeFilterPillClass()
                          : filterOptionPillClass(option.value)
                      }`}
                    >
                      {option.label}
                    </span>
                    {#if activeViewFilter() === option.value || (option.value === null && !activeViewFilter())}
                      <span aria-hidden="true">✓</span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <span aria-hidden="true" class="hidden text-zinc-300 sm:block">|</span>

          <div class="relative">
            <button
              type="button"
              onclick={() => toggleControlsMenu('sort')}
              aria-expanded={openControlsMenu === 'sort'}
              data-produce-controls-trigger="true"
              class={`inline-flex w-full items-center justify-between gap-1 rounded-full px-2.5 py-1 text-sm font-medium transition-colors sm:w-auto sm:justify-start ${activeSortPillClass()}`}
            >
              <span>{activeSortLabel()}</span>
              <span aria-hidden="true" class="text-[10px] text-zinc-500">▼</span>
            </button>

            {#if openControlsMenu === 'sort'}
              <div
                class="absolute top-full left-1/2 z-40 mt-2 w-[min(14rem,calc(100vw-2.5rem))] max-w-[calc(100vw-2.5rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-zinc-200 bg-white py-1 shadow-[0_16px_50px_-24px_rgba(0,0,0,0.45)] sm:right-0 sm:left-auto sm:w-44 sm:max-w-none sm:translate-x-0"
                data-produce-controls-menu="true"
              >
                <div class="px-4 py-2 text-xs font-semibold tracking-[0.08em] text-zinc-500 uppercase">
                  Sort by
                </div>
                {#each SORT_MENU_OPTIONS as option (option.label)}
                  <button
                    type="button"
                    onclick={() => {
                      option.apply();
                      hideControlsMenu();
                    }}
                    class="flex w-full items-center justify-between px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-50"
                  >
                    <span
                      class={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${
                        sortOptionPillClass(option.label)
                      }`}
                    >
                      {option.label}
                    </span>
                    {#if option.isActive(sortField, sortDirection)}
                      <span aria-hidden="true">✓</span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <span aria-hidden="true" class="hidden text-zinc-300 sm:block">|</span>

          <div class="relative">
            <button
              type="button"
              onclick={() => toggleControlsMenu('period')}
              aria-expanded={openControlsMenu === 'period'}
              data-produce-controls-trigger="true"
              class={`inline-flex w-full items-center justify-between gap-1 rounded-full px-2.5 py-1 text-sm font-medium transition-colors sm:w-auto sm:justify-start ${activePeriodPillClass()}`}
            >
              <span>{PERIOD_LABELS[timePeriod]}</span>
              <span aria-hidden="true" class="text-[10px] text-zinc-500">▼</span>
            </button>

            {#if openControlsMenu === 'period'}
              <div
                class="absolute top-full right-0 z-40 mt-2 w-[min(10rem,calc(100vw-2.5rem))] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white py-1 shadow-[0_16px_50px_-24px_rgba(0,0,0,0.45)] sm:w-32 sm:max-w-none"
                data-produce-controls-menu="true"
              >
                <div class="px-4 py-2 text-xs font-semibold tracking-[0.08em] text-zinc-500 uppercase">
                  Range by
                </div>
                {#each TIME_PERIODS as period (period)}
                  <button
                    type="button"
                    onclick={() => {
                      timePeriod = period;
                      hideControlsMenu();
                    }}
                    class="flex w-full items-center justify-between px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-50"
                  >
                    <span
                      class={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${periodOptionPillClass(period)}`}
                    >
                      {PERIOD_MENU_LABELS[period]}
                    </span>
                    {#if timePeriod === period}
                      <span aria-hidden="true">✓</span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <div class="h-px w-full bg-zinc-200"></div>

        <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5">
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

          <input
            type="search"
            value={search}
            oninput={(e) => {
              search = e.currentTarget.value;
            }}
            placeholder="Search produce..."
            class="min-w-[12rem] flex-1 bg-transparent text-zinc-900 placeholder-zinc-500 outline-none"
          />
        </div>
      </div>

      <div class="px-2 pt-2 pb-0 text-sm leading-5 text-zinc-500">
        {#if isLoading}
          <div class="feed-shimmer h-5 w-32 rounded"></div>
        {:else}
          <div class="flex items-center gap-1 overflow-hidden whitespace-nowrap">
            <span class="truncate">
              {filteredRows.length} of {quickFilterCount} items
              {#if dateRange}
                {' · Last updated '}
                {new Date(dateRange.end + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              {/if}
            </span>
            <span
              class={`ml-1 inline-block shrink-0 animate-spin transition-opacity duration-300 ${
                isRefreshing ? 'opacity-100' : 'opacity-0'
              }`}
            >
              🥕
            </span>
          </div>
        {/if}
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

  <div
    bind:this={virtualRowsAnchorRef}
    class={`${actionsMenu ? 'overflow-x-visible' : 'overflow-x-hidden'} transition-opacity duration-300 ease-in-out motion-reduce:transition-none`}
  >
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
        {:else if shouldShowClearFilterSearchCta}
          <tr>
            <td colspan="3" class="px-2 py-12 text-center">
              <p class="mx-auto max-w-sm text-sm text-zinc-500">
                No matches in {activeResultFilterLabel()} for "{search.trim()}".
              </p>
              <div class="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onclick={clearActiveResultFilter}
                  class="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                >
                  Search all
                </button>
                <button
                  type="button"
                  onclick={clearSearchQuery}
                  class="rounded-full bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
                >
                  Clear
                </button>
              </div>
            </td>
          </tr>
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
          {#if virtualPaddingTop > 0}
            <tr aria-hidden="true" class="pointer-events-none border-0">
              <td colspan="3" class="h-0 p-0" style={`height:${virtualPaddingTop}px;`}></td>
            </tr>
          {/if}
          {#each visibleVirtualRows as entry (entry.virtualRow.key)}
            {@const virtualRow = entry.virtualRow}
            {@const row = entry.row}
            {@const rowHistory = history.get(row.name)}
            {@const periodData = getPeriodData(row, timePeriod, rowHistory, dateRange)}
            {@const prev = periodData.prev}
            {@const change = prev !== null ? row.price - prev : null}
            {@const pct = prev !== null && prev !== 0 ? ((row.price - prev) / prev) * 100 : null}
            {@const showHighLow = getPeriodPointCount(rowHistory, dateRange, timePeriod) >= 3}
            {@const specialtyUrl = getSpecialtyProduceUrl(row.name)}
            <tr
              data-index={virtualRow.index}
              use:measureVirtualRow={virtualRow.index}
              animate:flip={{ duration: 420, easing: cubicOut }}
              in:fade={{ duration: 220 }}
              out:fade={{ duration: 180 }}
              class={`group select-none border-b border-zinc-100 ${actionsMenu?.itemName === row.name ? 'relative z-30' : ''} ${favorites.has(row.name) ? 'bg-amber-50' : 'hover:bg-zinc-50'}`}
            >
                <td
                  class={`${NAME_COL_CLASS} sticky left-0 box-border border-r border-zinc-200 p-2 md:w-auto md:border-r-0 ${
                    actionsMenu?.itemName === row.name ? 'z-30 overflow-visible' : 'z-10'
                  } ${
                    favorites.has(row.name) ? 'bg-amber-50' : 'bg-white group-hover:bg-zinc-50'
                  }`}
                >
                  <div class="flex items-start gap-2">
                    <div class="flex min-w-0 flex-1 flex-col gap-1">
                      <div
                        class="line-clamp-3 text-sm font-medium text-zinc-900 md:line-clamp-none"
                        data-produce-name="true"
                      >
                        {row.name}
                      </div>

                      <div class="text-xs text-zinc-500">
                        {#if row.is_unavailable && row.unavailable_since_date}
                          <span class="rounded bg-red-100 px-1 text-red-700">
                            <span class="inline-block">Out of stock</span>{' '}
                            <span class="inline-block">{formatOutOfStockDate(row.unavailable_since_date)}</span>
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

                      <div class="mt-auto flex justify-end gap-2 pt-1 text-[11px] font-medium text-zinc-400">
                        <button
                          type="button"
                          onclick={(event) => handleRowFavoriteButtonClick(event, row.name)}
                          aria-pressed={favorites.has(row.name)}
                          aria-label={favorites.has(row.name) ? `Remove ${row.name} from favorites` : `Add ${row.name} to favorites`}
                          class={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 transition-colors ${
                            favoriteCount(row.name) > 0
                              ? favorites.has(row.name)
                                ? 'text-amber-800 hover:bg-amber-100'
                                : 'text-zinc-500 hover:bg-amber-100 hover:text-amber-800'
                              : favorites.has(row.name)
                                ? 'text-amber-800'
                                : 'text-zinc-500'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            class={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm leading-none transition-colors ${
                              favoriteCount(row.name) > 0 ? '' : 'hover:bg-amber-100 hover:text-amber-800'
                            }`}
                          >
                            {favorites.has(row.name) ? '♥' : '♡'}
                          </span>
                          <span
                            aria-hidden="true"
                            class="inline-flex w-[2ch] justify-start text-[10px] leading-none"
                            style="font-variant-numeric: tabular-nums;"
                          >
                            {#if favoriteCount(row.name) > 0}
                              {favoriteCount(row.name)}
                            {/if}
                          </span>
                        </button>
                        <div class={`relative ${actionsMenu?.itemName === row.name ? 'z-50' : ''}`}>
                          <button
                            type="button"
                            onclick={(event) => handleRowActionsButtonClick(event, row.name, specialtyUrl)}
                            aria-expanded={actionsMenu?.itemName === row.name}
                            aria-label={`More actions for ${row.name}`}
                            data-produce-actions-trigger="true"
                            class="inline-flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                          >
                            <span aria-hidden="true" class="text-sm leading-none">⋯</span>
                          </button>

                          {#if actionsMenu?.itemName === row.name}
                            {@const currentActionsMenu = actionsMenu!}
                            <div
                              class="absolute top-1/2 left-full z-[80] ml-2 w-[min(248px,calc(100vw-48px))] max-w-[calc(100vw-48px)] -translate-y-1/2 overflow-hidden rounded-xl border border-zinc-200 bg-white text-left shadow-[0_16px_50px_-24px_rgba(0,0,0,0.65)] sm:w-[min(340px,calc(100vw-32px))] sm:max-w-[calc(100vw-32px)]"
                              style="max-height:min(28rem,calc(100vh-40px));"
                              data-produce-actions-menu="true"
                              aria-live="polite"
                            >
                              <div class="max-h-[min(28rem,calc(100vh-40px))] overflow-y-auto">
                                {#if currentActionsMenu.loading}
                                  <div>
                                    <div class="feed-shimmer h-28 w-full border-b border-zinc-100 sm:h-44"></div>
                                    <div class="space-y-1.5 p-2.5 sm:space-y-2 sm:p-3">
                                      <div class="feed-shimmer h-3 w-24 rounded sm:w-28"></div>
                                      <div class="feed-shimmer h-4 w-3/4 rounded sm:w-4/5"></div>
                                      <div class="feed-shimmer h-3 w-full rounded"></div>
                                      <div class="feed-shimmer h-3 w-11/12 rounded"></div>
                                    </div>
                                  </div>
                                {:else}
                                  {#if currentActionsMenu.data?.image}
                                    <img
                                      src={currentActionsMenu.data.image}
                                      alt=""
                                      class="h-28 w-full border-b border-zinc-100 object-cover sm:h-44"
                                      loading="lazy"
                                    />
                                  {/if}
                                  <div class="space-y-1 p-2.5 sm:p-3">
                                    <div class="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                                      {currentActionsMenu.data?.siteName ?? (currentActionsMenu.url ? 'Specialty Produce' : 'Produce')}
                                    </div>
                                    <div class="line-clamp-2 break-words text-[13px] font-semibold text-zinc-900 sm:text-sm">
                                      {currentActionsMenu.data?.title ?? currentActionsMenu.itemName}
                                    </div>
                                    {#if currentActionsMenu.data?.description}
                                      <p class="line-clamp-3 break-words text-[11px] leading-relaxed text-zinc-600 sm:line-clamp-4 sm:text-xs">
                                        {currentActionsMenu.data.description}
                                      </p>
                                    {/if}
                                  </div>
                                {/if}

                                {#if !currentActionsMenu.loading}
                                  <div class="border-t border-zinc-100 py-1">
                                    {#if currentActionsMenu.url}
                                      <a
                                        href={currentActionsMenu.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        class="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 sm:gap-3 sm:px-4 sm:py-2.5 sm:text-sm"
                                      >
                                        <span class="inline-flex h-5 w-5 items-center justify-center">↗</span>
                                        <span class="min-w-0 flex-1 break-words leading-snug">Visit Specialty Produce</span>
                                      </a>
                                    {/if}
                                    <button
                                      type="button"
                                      onclick={() => {
                                        void handleActionsMenuShare();
                                      }}
                                      class="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 sm:gap-3 sm:px-4 sm:py-2.5 sm:text-sm"
                                    >
                                      <span class="inline-flex h-5 w-5 items-center justify-center">
                                        {actionsMenuCopied ? '✅' : '⤴'}
                                      </span>
                                      <span class="min-w-0 flex-1 break-words leading-snug">{actionsMenuCopied ? 'Copied!' : 'Share'}</span>
                                    </button>
                                  </div>
                                {/if}
                              </div>
                            </div>
                          {/if}
                        </div>
                      </div>
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
          {#if virtualPaddingBottom > 0}
            <tr aria-hidden="true" class="pointer-events-none border-0">
              <td colspan="3" class="h-0 p-0" style={`height:${virtualPaddingBottom}px;`}></td>
            </tr>
          {/if}
        {/if}
      </tbody>
    </table>
  </div>

  <div bind:this={favoriteBurstLayerRef} class="favorite-burst-layer" aria-hidden="true">
    {#each favoriteBursts as burst (burst.id)}
      <span
        class="favorite-burst"
        style={`left:${burst.x}px;top:${burst.y}px;--burst-x-mid:${burst.xMid}px;--burst-y-mid:${burst.yMid}px;--burst-x-end:${burst.xEnd}px;--burst-y-end:${burst.yEnd}px;--burst-rotate-start:${burst.rotateStart}deg;--burst-rotate-end:${burst.rotateEnd}deg;--burst-duration:${burst.durationMs}ms;`}
        onanimationend={() => removeFavoriteBurst(burst.id)}
      >
        {burst.emoji}
      </span>
    {/each}
  </div>
</div>

<style>
  .favorite-burst-layer {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 70;
  }

  .favorite-burst {
    position: fixed;
    transform: translate(-50%, -50%) translate3d(0, 0, 0);
    font-size: 1.35rem;
    line-height: 1;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.24));
    animation: favoriteBurst var(--burst-duration) cubic-bezier(0.18, 0.74, 0.22, 1) forwards;
    will-change: transform, opacity;
  }

  @keyframes favoriteBurst {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) translate3d(0, 0, 0) rotate(var(--burst-rotate-start))
        scale(0.42);
    }
    22% {
      opacity: 1;
      transform: translate(-50%, -50%) translate3d(var(--burst-x-mid), var(--burst-y-mid), 0)
        rotate(calc(var(--burst-rotate-start) * 0.45)) scale(1.08);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) translate3d(var(--burst-x-end), var(--burst-y-end), 0)
        rotate(var(--burst-rotate-end)) scale(0.78);
    }
  }
</style>
