'use client';

import Fuse from 'fuse.js';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProduceContextMenu } from '@/components/ProduceContextMenu';
import { useScrollVisibility } from '@/components/ScrollVisibilityProvider';
import { produceHash } from '@/lib/produce-hash';
import { getSpecialtyProduceUrl } from '@/lib/specialty-produce-map';
import { useProduceFavorites } from '@/lib/use-produce-favorites';
import type {
  ProduceDateRange,
  ProduceHistoryMap,
  ProduceHistoryPoint,
  ProduceRow,
} from '@/lib/use-produce-data';

type TimePeriod =
  | '1D'
  | '1W'
  | '1M'
  | '3M'
  | '6M'
  | '1Y'
  | '2Y'
  | '5Y'
  | '10Y'
  | 'SINCE_2013'
  | 'YTD';
type SortField = 'name' | 'price' | 'change' | 'first_seen' | 'last_seen';
type SortDirection = 'asc' | 'desc' | null;

interface ProduceAnalyticsProps {
  data: ProduceRow[];
  history: ProduceHistoryMap;
  dateRange: ProduceDateRange | null;
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: string | null;
  initialDateFilter?: string | null;
  initialItemFilter?: string | null;
}

type QuickFilter = 'favorites' | 'drops' | 'increases' | 'new' | 'recently_unavailable' | null;

const NAME_COL_CLASS = 'w-1/3 min-w-[33.333%] max-w-[33.333%] md:w-2/5 md:min-w-0 md:max-w-none';
const DATA_COL_CLASS = 'w-1/3 min-w-[33.333%] max-w-[33.333%] md:w-auto md:min-w-0 md:max-w-none';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CONNECTED_GAP_DAYS = 3;
const SINCE_2013_START_MS = new Date('2013-01-01T00:00:00').getTime();
const FAVORITE_SWIPE_THRESHOLD_PX = 56;
const FAVORITE_SWIPE_THRESHOLD_RATIO = 0.75;
const FAVORITE_SWIPE_MAX_VERTICAL_PX = 40;
const FAVORITE_SWIPE_MAX_OFFSET_PX = 88;

const TIME_PERIODS: TimePeriod[] = [
  '1D',
  '1W',
  '1M',
  '3M',
  '6M',
  '1Y',
  '2Y',
  '5Y',
  '10Y',
  'SINCE_2013',
  'YTD',
];
const TIME_PERIOD_SET = new Set<TimePeriod>(TIME_PERIODS);
const PERIOD_BUTTON_LABELS: Record<TimePeriod, string> = {
  '1D': '1D',
  '1W': '1W',
  '1M': '1M',
  '3M': '3M',
  '6M': '6M',
  '1Y': '1Y',
  '2Y': '2Y',
  '5Y': '5Y',
  '10Y': '10Y',
  SINCE_2013: 'Since 2013',
  YTD: 'YTD',
};
const PERIOD_METRIC_LABELS: Record<TimePeriod, string> = {
  '1D': 'Past day',
  '1W': 'Past week',
  '1M': 'Past month',
  '3M': 'Past 3 months',
  '6M': 'Past 6 months',
  '1Y': 'Past year',
  '2Y': 'Past 2 years',
  '5Y': 'Past 5 years',
  '10Y': 'Past 10 years',
  SINCE_2013: 'Since 2013',
  YTD: 'Year to date',
};

function isTimePeriod(value: unknown): value is TimePeriod {
  return typeof value === 'string' && TIME_PERIOD_SET.has(value as TimePeriod);
}

const QUICK_FILTER_LABELS: Record<NonNullable<QuickFilter>, string> = {
  favorites: 'Favorites',
  drops: 'Price Drops',
  increases: 'Price Increases',
  new: 'New Arrivals',
  recently_unavailable: 'Out of Stock',
};

const QUICK_FILTER_CHIP_COLORS: Record<NonNullable<QuickFilter>, string> = {
  favorites: 'bg-amber-100 text-amber-800',
  drops: 'bg-green-100 text-green-700',
  increases: 'bg-red-100 text-red-700',
  new: 'bg-[rgb(255,246,220)] text-[#3F7540]',
  recently_unavailable: 'bg-red-100 text-red-700',
};

function getDateFilterGroupRank(row: ProduceRow): number {
  // Out of stock takes precedence when both labels are present.
  if (row.is_unavailable) return 1;
  if (row.is_new) return 0;
  return 2;
}

interface ProduceAttributeDocument {
  id: string;
  name: string;
  origin: string;
  attributes: string;
}

interface ProduceSearchResults {
  ids: Set<string>;
  scores: Map<string, number>;
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

function getHistoryPeriodData(
  points: ProduceHistoryPoint[] | undefined,
  dateRange: ProduceDateRange | null,
  period: TimePeriod,
) {
  if (!points || points.length === 0) {
    return {
      prev: null,
      high: null,
      low: null,
    };
  }

  const endMs = dateRange
    ? new Date(dateRange.end + 'T00:00:00').getTime()
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

function getPeriodData(
  row: ProduceRow,
  period: TimePeriod,
  points?: ProduceHistoryPoint[],
  dateRange: ProduceDateRange | null = null,
) {
  switch (period) {
    case '1D':
      return {
        prev: row.prev_day_price,
        high: row.day_high,
        low: row.day_low,
      };
    case '1W':
      return {
        prev: row.prev_week_price,
        high: row.week_high,
        low: row.week_low,
      };
    case '1M':
      return {
        prev: row.prev_month_price,
        high: row.month_high,
        low: row.month_low,
      };
    case '3M':
      return {
        prev: row.prev_3_month_price,
        high: row.three_month_high,
        low: row.three_month_low,
      };
    case '6M':
      return {
        prev: row.prev_6_month_price,
        high: row.six_month_high,
        low: row.six_month_low,
      };
    case '1Y':
      return {
        prev: row.prev_year_price,
        high: row.year_high,
        low: row.year_low,
      };
    case '2Y':
      return {
        prev: row.prev_2_year_price,
        high: row.two_year_high,
        low: row.two_year_low,
      };
    case '5Y':
    case '10Y':
    case 'SINCE_2013':
      return getHistoryPeriodData(points, dateRange, period);
    case 'YTD':
      return {
        prev: row.prev_ytd_price,
        high: row.ytd_high,
        low: row.ytd_low,
      };
    default:
      return {
        prev: row.prev_day_price,
        high: row.day_high,
        low: row.day_low,
      };
  }
}

function getPeriodStartMs(period: TimePeriod, endMs: number): number {
  switch (period) {
    case '1D':
      return endMs - DAY_MS;
    case '1W':
      return endMs - 7 * DAY_MS;
    case '1M':
      return endMs - 30 * DAY_MS;
    case '3M':
      return endMs - 90 * DAY_MS;
    case '6M':
      return endMs - 180 * DAY_MS;
    case '1Y':
      return endMs - 365 * DAY_MS;
    case '2Y':
      return endMs - 730 * DAY_MS;
    case '5Y':
      return endMs - 1825 * DAY_MS;
    case '10Y':
      return endMs - 3650 * DAY_MS;
    case 'SINCE_2013':
      return SINCE_2013_START_MS;
    case 'YTD': {
      const endDate = new Date(endMs);
      return new Date(endDate.getFullYear(), 0, 1).getTime();
    }
    default:
      return endMs - DAY_MS;
  }
}

function getScaleStartMs(period: TimePeriod, endMs: number): number {
  switch (period) {
    case '1D':
    case '1W':
    case '1M':
      return endMs - 30 * DAY_MS;
    case '3M':
    case '6M':
    case '1Y':
      return endMs - 365 * DAY_MS;
    case '2Y':
      return endMs - 730 * DAY_MS;
    case '5Y':
      return endMs - 1825 * DAY_MS;
    case '10Y':
      return endMs - 3650 * DAY_MS;
    case 'SINCE_2013':
      return SINCE_2013_START_MS;
    case 'YTD': {
      const endDate = new Date(endMs);
      return new Date(endDate.getFullYear(), 0, 1).getTime();
    }
    default:
      return endMs - 30 * DAY_MS;
  }
}

function downsampleForTimePeriod(
  points: ProduceHistoryPoint[],
  period: TimePeriod,
): ProduceHistoryPoint[] {
  if (points.length < 2) return points;

  if (period === '5Y' || period === '10Y') {
    const bucketSizeMs = (period === '5Y' ? 7 : 14) * DAY_MS;
    const sampled: ProduceHistoryPoint[] = [];
    let activeBucket: number | null = null;

    for (const point of points) {
      const pointMs = new Date(point.date + 'T00:00:00').getTime();
      const bucket = Math.floor(pointMs / bucketSizeMs);
      if (bucket !== activeBucket) {
        sampled.push(point);
        activeBucket = bucket;
      } else {
        sampled[sampled.length - 1] = point;
      }
    }

    return sampled;
  }

  if (period === 'SINCE_2013') {
    const sampled: ProduceHistoryPoint[] = [];
    let activeMonthKey: string | null = null;

    for (const point of points) {
      const date = new Date(point.date + 'T00:00:00');
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthKey !== activeMonthKey) {
        sampled.push(point);
        activeMonthKey = monthKey;
      }
    }

    return sampled;
  }

  return points;
}

function getConnectedGapThresholdMs(period: TimePeriod): number {
  switch (period) {
    case '5Y':
      return 7 * DAY_MS;
    case '10Y':
      return 14 * DAY_MS;
    case 'SINCE_2013':
      return 31 * DAY_MS;
    default:
      return MAX_CONNECTED_GAP_DAYS * DAY_MS;
  }
}

export function ProduceAnalytics({
  data,
  history,
  dateRange,
  isLoading = false,
  isRefreshing = false,
  error = null,
  initialDateFilter = null,
  initialItemFilter = null,
}: ProduceAnalyticsProps) {
  const [initialFilters] = useState(() => {
    const firstVisit = {
      quickFilter: 'drops' as QuickFilter,
      timePeriod: '1D' as TimePeriod,
      sortField: 'change' as SortField | null,
      sortDirection: 'asc' as SortDirection,
    };
    if (initialItemFilter || initialDateFilter) {
      return {
        ...firstVisit,
        quickFilter: null as QuickFilter,
        // Deep-linked day view should use its own default grouping sort.
        sortField: initialDateFilter ? (null as SortField | null) : ('name' as SortField | null),
        sortDirection: initialDateFilter ? (null as SortDirection) : ('asc' as SortDirection),
      };
    }
    if (typeof window === 'undefined') return firstVisit;
    try {
      const stored = localStorage.getItem('produce-filters');
      if (!stored) return firstVisit;
      const parsed = JSON.parse(stored) as Partial<typeof firstVisit>;
      return {
        quickFilter: parsed.quickFilter ?? firstVisit.quickFilter,
        timePeriod: isTimePeriod(parsed.timePeriod) ? parsed.timePeriod : firstVisit.timePeriod,
        sortField: parsed.sortField ?? firstVisit.sortField,
        sortDirection: parsed.sortDirection ?? firstVisit.sortDirection,
      };
    } catch {
      return firstVisit;
    }
  });
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(initialFilters.sortField);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialFilters.sortDirection);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(initialFilters.quickFilter);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(initialFilters.timePeriod);
  const [dateFilter, setDateFilter] = useState<string | null>(initialDateFilter);
  const [itemFilter, setItemFilter] = useState<string | null>(initialItemFilter);
  const [contextMenu, setContextMenu] = useState<{ itemName: string; x: number; y: number } | null>(
    null,
  );
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [pressedRow, setPressedRow] = useState<string | null>(null);
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});
  const [activeSwipeItem, setActiveSwipeItem] = useState<string | null>(null);
  const [nameCellWidths, setNameCellWidths] = useState<Record<string, number>>({});
  const { favorites, toggleFavorite } = useProduceFavorites();
  const { showSticky } = useScrollVisibility();
  const controlsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStartRef = useRef<{
    itemName: string;
    x: number;
    y: number;
    dx: number;
    dy: number;
    thresholdHapticFired: boolean;
  } | null>(null);

  useEffect(() => {
    localStorage.setItem(
      'produce-filters',
      JSON.stringify({ quickFilter, timePeriod, sortField, sortDirection }),
    );
  }, [quickFilter, timePeriod, sortField, sortDirection]);

  const stickyVisible = showSticky || isSearchFocused;

  const activeViewFilter =
    quickFilter === 'favorites' || quickFilter === 'new' || quickFilter === 'recently_unavailable'
      ? quickFilter
      : null;
  const hasAnyViewFilter = activeViewFilter !== null;
  const hasAnyScopedFilter = hasAnyViewFilter || dateFilter !== null || itemFilter !== null;
  const isPriceDropsSort = sortField === 'change' && sortDirection === 'asc';
  const isPriceIncreasesSort = sortField === 'change' && sortDirection === 'desc';
  const normalizedSearchTerm = search.trim().toLowerCase();
  const hasSearchQuery = normalizedSearchTerm.length > 0;
  const [allowQuerySortOverride, setAllowQuerySortOverride] = useState(false);

  const searchDocs = useMemo(
    () =>
      data.map<ProduceAttributeDocument>((row) => ({
        id: produceHash(row.name),
        name: row.name,
        origin: row.origin,
        attributes: getProduceAttributeTerms(row),
      })),
    [data],
  );

  const produceFuse = useMemo(
    () =>
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
    [searchDocs],
  );

  const attributeSearchResults = useMemo<ProduceSearchResults | null>(() => {
    if (!hasSearchQuery) return null;

    const searchResults = produceFuse.search(normalizedSearchTerm);
    const scores = new Map(
      searchResults.map((hit) => [hit.item.id, hit.score ?? Number.MAX_VALUE]),
    );

    return {
      ids: new Set(scores.keys()),
      scores,
    };
  }, [produceFuse, hasSearchQuery, normalizedSearchTerm]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('force-sticky', { detail: isSearchFocused }));
  }, [isSearchFocused]);

  useEffect(() => {
    const element = controlsRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    const updateHeight = () => {
      window.dispatchEvent(new CustomEvent('sticky-threshold', { detail: element.offsetHeight }));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const quickFilterCount = useMemo(() => {
    let base = data;
    if (dateFilter) {
      base = base.filter(
        (row) => row.first_seen_date === dateFilter || row.unavailable_since_date === dateFilter,
      );
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
    // recently_unavailable
    return base.filter((row) => row.is_unavailable).length;
  }, [data, quickFilter, favorites, dateFilter]);

  const filteredAndSorted = useMemo(() => {
    let result = data;

    // Filter by item hash
    if (itemFilter) {
      result = result.filter((row) => produceHash(row.name) === itemFilter);
    }

    // Filter by date
    if (dateFilter) {
      result = result.filter(
        (row) => row.first_seen_date === dateFilter || row.unavailable_since_date === dateFilter,
      );
    }

    // Filter by search
    if (attributeSearchResults) {
      result = result.filter((row) => attributeSearchResults.ids.has(produceHash(row.name)));
    }

    // Filter by quick filter
    if (quickFilter === 'favorites') {
      result = result.filter((row) => favorites.has(row.name));
    } else if (quickFilter === 'new') {
      result = result.filter((row) => row.is_new);
    } else if (quickFilter === 'recently_unavailable') {
      result = result.filter((row) => row.is_unavailable);
    }

    if (hasSearchQuery && attributeSearchResults && !allowQuerySortOverride) {
      return [...result].sort((a, b) => {
        const aScore = attributeSearchResults.scores.get(produceHash(a.name)) ?? Number.MAX_VALUE;
        const bScore = attributeSearchResults.scores.get(produceHash(b.name)) ?? Number.MAX_VALUE;
        return aScore - bScore;
      });
    }

    // Specific-day view: new arrivals first, then out of stock. Sort names within each group.
    if (dateFilter && (!sortField || !sortDirection)) {
      return [...result].sort((a, b) => {
        const aRank = getDateFilterGroupRank(a);
        const bRank = getDateFilterGroupRank(b);

        if (aRank !== bRank) return aRank - bRank;
        return a.name.localeCompare(b.name);
      });
    }

    // Sort
    if (!sortField || !sortDirection) {
      return result;
    }

    result = [...result].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'price':
          aVal = a.price;
          bVal = b.price;
          break;
        case 'change': {
          const aPeriod = getPeriodData(a, timePeriod, history.get(a.name), dateRange);
          const bPeriod = getPeriodData(b, timePeriod, history.get(b.name), dateRange);
          aVal = aPeriod.prev !== null ? (a.price - aPeriod.prev) / aPeriod.prev : 0;
          bVal = bPeriod.prev !== null ? (b.price - bPeriod.prev) / bPeriod.prev : 0;
          break;
        }
        case 'first_seen':
          aVal = a.first_seen_date ?? '';
          bVal = b.first_seen_date ?? '';
          break;
        case 'last_seen':
          aVal = a.unavailable_since_date ?? '';
          bVal = b.unavailable_since_date ?? '';
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [
    data,
    sortField,
    sortDirection,
    quickFilter,
    favorites,
    history,
    timePeriod,
    dateRange,
    dateFilter,
    itemFilter,
    hasSearchQuery,
    attributeSearchResults,
    allowQuerySortOverride,
  ]);

  const allSearchResultCount = useMemo(() => {
    if (!attributeSearchResults) return 0;
    return data.filter((row) => attributeSearchResults.ids.has(produceHash(row.name))).length;
  }, [data, attributeSearchResults]);

  const showSearchAllButton =
    hasSearchQuery &&
    hasAnyScopedFilter &&
    filteredAndSorted.length === 0 &&
    allSearchResultCount > 0;

  const itemFilterName = useMemo(() => {
    if (!itemFilter) return null;
    return data.find((row) => produceHash(row.name) === itemFilter)?.name ?? null;
  }, [data, itemFilter]);

  const skeletonRows = useMemo(
    () => Array.from({ length: 8 }, (_, index) => `skeleton-${index}`),
    [],
  );

  const handleSort = (field: SortField) => {
    if (hasSearchQuery) {
      setAllowQuerySortOverride(true);
    }

    let newField: SortField | null = field;
    let newDirection: SortDirection = 'asc';

    if (sortField === field) {
      if (sortDirection === 'asc') {
        newDirection = 'desc';
      } else if (sortDirection === 'desc') {
        newField = null;
        newDirection = null;
      }
    }

    setSortField(newField);
    setSortDirection(newDirection);

    // Sync pills with sort state only for All/Drops/Increases flows.
    // Preserve explicit views (favorites/new/recently_unavailable) when sorting.
    const shouldSyncQuickFilter =
      quickFilter === null || quickFilter === 'drops' || quickFilter === 'increases';

    if (shouldSyncQuickFilter) {
      if (!newField || !newDirection || newField === 'name' || newField === 'price') {
        setQuickFilter(null);
      } else if (newField === 'change') {
        setQuickFilter(newDirection === 'asc' ? 'drops' : 'increases');
      }
    }
  };

  const clearDateFilter = () => {
    if (hasSearchQuery) {
      setAllowQuerySortOverride(true);
    }
    setDateFilter(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('date');
    window.history.replaceState(null, '', url.pathname + url.search);
  };

  const clearItemFilter = () => {
    if (hasSearchQuery) {
      setAllowQuerySortOverride(true);
    }
    setItemFilter(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('item');
    url.searchParams.delete('name');
    window.history.replaceState(null, '', url.pathname + url.search);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, itemName: string) => {
    e.preventDefault();
    setContextMenu({ itemName, x: e.clientX, y: e.clientY });
  }, []);

  const isSparklineTarget = useCallback((target: EventTarget | null) => {
    return (
      target instanceof Element && target.closest('[data-sparkline-interactive="true"]') !== null
    );
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, itemName: string) => {
      if (isSparklineTarget(e.target)) {
        return;
      }
      const touch = e.touches[0];
      const x = touch.clientX;
      const y = touch.clientY;
      setPressedRow(itemName);
      swipeStartRef.current = { itemName, x, y, dx: 0, dy: 0, thresholdHapticFired: false };
      setActiveSwipeItem(itemName);
      setSwipeOffsets((prev) => ({ ...prev, [itemName]: 0 }));
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        setPressedRow(null);
        navigator.vibrate?.(10);
        setContextMenu({ itemName, x, y });
      }, 500);
    },
    [isSparklineTarget],
  );

  const getSwipeThresholdPx = useCallback(
    (itemName: string) => {
      const measuredWidth = nameCellWidths[itemName];
      if (!measuredWidth || !Number.isFinite(measuredWidth)) {
        return FAVORITE_SWIPE_THRESHOLD_PX;
      }
      return Math.max(FAVORITE_SWIPE_THRESHOLD_PX, measuredWidth * FAVORITE_SWIPE_THRESHOLD_RATIO);
    },
    [nameCellWidths],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent, itemName: string) => {
      const swipe = swipeStartRef.current;
      if (!swipe || swipe.itemName !== itemName) return;
      const touch = e.touches[0];
      swipe.dx = touch.clientX - swipe.x;
      swipe.dy = touch.clientY - swipe.y;

      if (
        Math.abs(swipe.dx) > 8 &&
        Math.abs(swipe.dx) > Math.abs(swipe.dy) &&
        longPressTimer.current !== null
      ) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        setPressedRow(null);
      }

      if (
        Math.abs(swipe.dy) <= FAVORITE_SWIPE_MAX_VERTICAL_PX &&
        Math.abs(swipe.dx) > Math.abs(swipe.dy)
      ) {
        const thresholdPx = getSwipeThresholdPx(itemName);
        const maxOffsetPx = Math.max(FAVORITE_SWIPE_MAX_OFFSET_PX, thresholdPx + 16);
        const clamped = Math.max(0, Math.min(maxOffsetPx, swipe.dx));
        setSwipeOffsets((prev) => ({ ...prev, [itemName]: clamped }));

        if (swipe.dx >= thresholdPx && !swipe.thresholdHapticFired) {
          swipe.thresholdHapticFired = true;
          navigator.vibrate?.(8);
        }
      }
    },
    [getSwipeThresholdPx],
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setPressedRow(null);
    swipeStartRef.current = null;
  }, []);

  const handleTouchEnd = useCallback(
    (itemName: string) => {
      const swipe = swipeStartRef.current;
      if (swipe && swipe.itemName === itemName) {
        const thresholdPx = getSwipeThresholdPx(itemName);
        const didSwipeFarEnough =
          swipe.dx >= thresholdPx && Math.abs(swipe.dy) <= FAVORITE_SWIPE_MAX_VERTICAL_PX;
        if (didSwipeFarEnough) {
          toggleFavorite(itemName);
        }
      }
      setActiveSwipeItem(null);
      setSwipeOffsets((prev) => ({ ...prev, [itemName]: 0 }));
      cancelLongPress();
    },
    [cancelLongPress, getSwipeThresholdPx, toggleFavorite],
  );

  const handleTouchCancel = useCallback(
    (itemName: string) => {
      setActiveSwipeItem(null);
      setSwipeOffsets((prev) => ({ ...prev, [itemName]: 0 }));
      cancelLongPress();
    },
    [cancelLongPress],
  );

  const handleNameCellWidth = useCallback((itemName: string, width: number) => {
    if (!width) return;
    setNameCellWidths((prev) => (prev[itemName] === width ? prev : { ...prev, [itemName]: width }));
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleQuickFilter = (filter: QuickFilter) => {
    if (hasSearchQuery) {
      setAllowQuerySortOverride(true);
    }

    if (dateFilter) clearDateFilter();

    if (filter === 'drops' || filter === 'increases') {
      const isAlreadySelected =
        (filter === 'drops' && isPriceDropsSort) ||
        (filter === 'increases' && isPriceIncreasesSort);

      if (isAlreadySelected) {
        if (activeViewFilter === 'favorites') {
          setSortField('name');
          setSortDirection('asc');
          return;
        }

        if (activeViewFilter === 'new') {
          setSortField('first_seen');
          setSortDirection('desc');
          return;
        }

        if (activeViewFilter === 'recently_unavailable') {
          setSortField('last_seen');
          setSortDirection('desc');
          return;
        }

        setQuickFilter(null);
        setSortField('name');
        setSortDirection('asc');
        return;
      }

      if (!activeViewFilter) {
        setQuickFilter(filter);
      }
      setSortField('change');
      setSortDirection(filter === 'drops' ? 'asc' : 'desc');
      return;
    }

    if (quickFilter === filter) {
      // Clicking same filter again - reset to default
      setQuickFilter(null);
      setSortField('name');
      setSortDirection('asc');
    } else {
      setQuickFilter(filter);
      if (filter === 'favorites') {
        setSortField('name');
        setSortDirection('asc');
      } else if (filter === 'new') {
        setSortField('first_seen');
        setSortDirection('desc');
      } else if (filter === 'recently_unavailable') {
        setSortField('last_seen');
        setSortDirection('desc');
      }
    }
  };

  return (
    <div>
      {/* Sticky controls + table header */}
      <div
        ref={controlsRef}
        className={`sticky top-24 z-20 bg-white transition-opacity duration-300 ease-in-out motion-reduce:transition-none md:top-14 ${
          stickyVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <h1 className="py-6 text-2xl font-bold text-zinc-900">Produce</h1>
        {/* Search */}
        <div className="mb-4">
          <div className="flex w-full max-w-md items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2">
            {itemFilterName && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800">
                <span className="max-w-[120px] truncate">{itemFilterName}</span>
                <button
                  type="button"
                  aria-label="Remove item filter"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearItemFilter();
                  }}
                  className="ml-0.5 rounded-full p-0.5 transition hover:opacity-70"
                >
                  ✕
                </button>
              </span>
            )}
            {dateFilter && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                {formatShortDate(dateFilter)}
                <button
                  type="button"
                  aria-label="Remove date filter"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearDateFilter();
                  }}
                  className="ml-0.5 rounded-full p-0.5 transition hover:opacity-70"
                >
                  ✕
                </button>
              </span>
            )}
            {!hasAnyScopedFilter && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-white">
                All
              </span>
            )}
            {activeViewFilter && (
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${QUICK_FILTER_CHIP_COLORS[activeViewFilter]}`}
              >
                {QUICK_FILTER_LABELS[activeViewFilter]}
                <button
                  type="button"
                  aria-label={`Remove ${QUICK_FILTER_LABELS[activeViewFilter]} filter`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasSearchQuery) {
                      setAllowQuerySortOverride(true);
                    }
                    setQuickFilter(null);
                    setSortField('name');
                    setSortDirection('asc');
                  }}
                  className="ml-0.5 rounded-full p-0.5 transition hover:opacity-70"
                >
                  ✕
                </button>
              </span>
            )}
            <input
              ref={searchInputRef}
              type="text"
              placeholder={
                dateFilter
                  ? `Search within ${formatShortDate(dateFilter)}...`
                  : activeViewFilter
                    ? 'Search within filter...'
                    : 'Search produce...'
              }
              value={search}
              onChange={(e) => {
                const nextValue = e.target.value;
                setSearch(nextValue);
                if (nextValue.trim().length === 0) {
                  setAllowQuerySortOverride(false);
                }
              }}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && search === '') {
                  if (activeViewFilter) {
                    if (hasSearchQuery) {
                      setAllowQuerySortOverride(true);
                    }
                    setQuickFilter(null);
                    setSortField('name');
                    setSortDirection('asc');
                  } else if (dateFilter) {
                    clearDateFilter();
                  } else if (itemFilter) {
                    clearItemFilter();
                  }
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-zinc-900 placeholder-zinc-500 outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setAllowQuerySortOverride(false);
              }}
              aria-label="Clear search"
              className={`shrink-0 rounded-full p-1 text-sm text-zinc-500 transition hover:text-zinc-700 ${search ? 'visible' : 'invisible'}`}
            >
              ✕
            </button>
          </div>
          <div className="p-2 text-sm text-zinc-500">
            {isLoading ? (
              <div className="feed-shimmer h-5 w-32 rounded" />
            ) : (
              <>
                Showing {filteredAndSorted.length} of {quickFilterCount} items
                {dateRange ? (
                  <>
                    {' · Last updated '}
                    {new Date(dateRange.end + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </>
                ) : null}
                <span
                  className={`ml-2 inline-block animate-spin transition-opacity duration-300 ${isRefreshing ? 'opacity-100' : 'opacity-0'}`}
                >
                  🥕
                </span>
              </>
            )}
          </div>
        </div>

        {/* Filter and sort chip rows */}
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (hasSearchQuery) {
                  setAllowQuerySortOverride(true);
                }
                if (dateFilter) clearDateFilter();
                setQuickFilter(null);
                setSortField('name');
                setSortDirection('asc');
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                !hasAnyScopedFilter
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter('favorites')}
              className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                quickFilter === 'favorites'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Favorites
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter('new')}
              className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                quickFilter === 'new'
                  ? 'bg-[rgb(255,246,220)] text-[#3F7540]'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              New Arrivals
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter('recently_unavailable')}
              className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                quickFilter === 'recently_unavailable'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Out of Stock
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleQuickFilter('drops')}
              className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                isPriceDropsSort
                  ? 'bg-green-100 text-green-700'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Price Drops
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter('increases')}
              className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                isPriceIncreasesSort
                  ? 'bg-red-100 text-red-700'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Price Increases
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {TIME_PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setTimePeriod(period)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  timePeriod === period
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {PERIOD_BUTTON_LABELS[period]}
              </button>
            ))}
          </div>
        </div>

        {error && !isLoading && <div className="mb-4 text-sm text-red-600">{error}</div>}

        {/* Header table */}
        <table className="w-full min-w-full table-fixed text-sm">
          <Colgroup />
          <thead>
            <tr className="border-b border-zinc-200">
              <SortHeader
                field="name"
                current={sortField}
                direction={sortDirection}
                onClick={handleSort}
                className={`${NAME_COL_CLASS} sticky left-0 z-10 border-r border-zinc-200 bg-white md:border-r-0`}
              >
                Name
              </SortHeader>
              <SortHeader
                field="price"
                current={sortField}
                direction={sortDirection}
                onClick={handleSort}
                className={DATA_COL_CLASS}
              >
                Price
              </SortHeader>
              <SortHeader
                field="change"
                current={sortField}
                direction={sortDirection}
                onClick={handleSort}
                className={DATA_COL_CLASS}
              >
                {PERIOD_METRIC_LABELS[timePeriod]}
              </SortHeader>
            </tr>
          </thead>
        </table>
      </div>

      {/* Body table */}
      <div className="overflow-x-hidden transition-opacity duration-300 ease-in-out motion-reduce:transition-none">
        <table className="w-full min-w-full table-fixed text-sm">
          <Colgroup />
          <tbody>
            {isLoading ? (
              skeletonRows.map((rowId) => <SkeletonRow key={rowId} />)
            ) : quickFilter === 'favorites' && favorites.size === 0 ? (
              <tr>
                <td colSpan={3} className="px-2 py-12 text-center">
                  <p className="mx-auto max-w-xs text-sm text-zinc-500">
                    You have no produce favorites at the Coop :( Search for produce items to
                    favorite and stay up to date!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickFilter(null);
                      setSortField('name');
                      setSortDirection('asc');
                      setSearch('');
                      searchInputRef.current?.focus();
                    }}
                    className="mt-3 rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                  >
                    Find favorites
                  </button>
                </td>
              </tr>
            ) : filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-2 py-12 text-center">
                  <p className="text-sm text-zinc-500">
                    {showSearchAllButton
                      ? 'No matches in this view. Search across all inventory?'
                      : 'No results found. Try a different search!'}
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (search) {
                          setSearch('');
                          setAllowQuerySortOverride(false);
                        } else {
                          setQuickFilter(null);
                        }
                        searchInputRef.current?.focus();
                      }}
                      className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                    >
                      Clear search
                    </button>
                    {showSearchAllButton && (
                      <button
                        type="button"
                        onClick={() => {
                          if (hasSearchQuery) {
                            setAllowQuerySortOverride(true);
                          }
                          setQuickFilter(null);
                          if (dateFilter || itemFilter) {
                            const url = new URL(window.location.href);
                            if (dateFilter) {
                              setDateFilter(null);
                              url.searchParams.delete('date');
                            }
                            if (itemFilter) {
                              setItemFilter(null);
                              url.searchParams.delete('item');
                              url.searchParams.delete('name');
                            }
                            window.history.replaceState(null, '', url.pathname + url.search);
                          }
                          searchInputRef.current?.focus();
                        }}
                        className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                      >
                        Search all
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((row) => {
                return (
                  <ProduceTableRow
                    key={row.name}
                    row={row}
                    isFavorited={favorites.has(row.name)}
                    specialtyUrl={getSpecialtyProduceUrl(row.name)}
                    isPressed={pressedRow === row.name}
                    isActiveSwipe={activeSwipeItem === row.name}
                    swipeOffset={swipeOffsets[row.name] ?? 0}
                    timePeriod={timePeriod}
                    history={history}
                    dateRange={dateRange}
                    onContextMenu={handleContextMenu}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    onTouchCancel={handleTouchCancel}
                    onMeasureNameCell={handleNameCellWidth}
                    getSwipeThresholdPx={getSwipeThresholdPx}
                    toggleFavorite={toggleFavorite}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {contextMenu && (
        <ProduceContextMenu
          itemName={contextMenu.itemName}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}

const ProduceTableRow = memo(function ProduceTableRow({
  row,
  isFavorited,
  specialtyUrl,
  isPressed,
  isActiveSwipe,
  swipeOffset,
  timePeriod,
  history,
  dateRange,
  onContextMenu,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onTouchCancel,
  onMeasureNameCell,
  getSwipeThresholdPx,
  toggleFavorite,
}: {
  row: ProduceRow;
  isFavorited: boolean;
  specialtyUrl: string | null;
  isPressed: boolean;
  isActiveSwipe: boolean;
  swipeOffset: number;
  timePeriod: TimePeriod;
  history: ProduceHistoryMap;
  dateRange: ProduceDateRange | null;
  onContextMenu: (event: React.MouseEvent, itemName: string) => void;
  onTouchStart: (event: React.TouchEvent, itemName: string) => void;
  onTouchEnd: (itemName: string) => void;
  onTouchMove: (event: React.TouchEvent, itemName: string) => void;
  onTouchCancel: (itemName: string) => void;
  onMeasureNameCell: (itemName: string, width: number) => void;
  getSwipeThresholdPx: (itemName: string) => number;
  toggleFavorite: (itemName: string) => void;
}) {
  const rowHistory = history.get(row.name);
  const isSwiping = swipeOffset !== 0;
  const swipeThresholdPx = getSwipeThresholdPx(row.name);
  const thresholdReached = swipeOffset >= swipeThresholdPx;
  const revealActionIsFavorite = !isFavorited;
  const revealIcon = revealActionIsFavorite ? '⭐' : '💔';
  const swipeCoverClass = isFavorited ? 'bg-amber-50' : 'bg-white';
  const rowBaseClass = isPressed ? 'bg-zinc-100' : isFavorited ? 'bg-amber-50' : 'hover:bg-zinc-50';
  const revealColor = revealActionIsFavorite ? 'rgba(255, 251, 235, 1)' : 'rgba(254, 202, 202, 1)';
  const swipeStyle = {
    transform: `translateX(${swipeOffset}px)`,
    transition: isActiveSwipe ? 'none' : 'transform 180ms ease-out',
  };
  const rowStyle =
    isSwiping && swipeOffset > 0
      ? {
          backgroundImage: `linear-gradient(to right, ${revealColor} 0px, ${revealColor} ${swipeOffset}px, transparent ${swipeOffset}px)`,
        }
      : undefined;
  const { prev } = getPeriodData(row, timePeriod, rowHistory, dateRange);
  const priceTrendClass =
    prev !== null && row.price < prev
      ? 'text-green-600'
      : prev !== null && row.price > prev
        ? 'text-red-600'
        : '';
  const attributeElements = [
    row.is_hydroponic && {
      key: 'hydroponic',
      node: <span>Hydroponic</span>,
    },
    row.is_ipm && {
      key: 'ipm',
      node: <span>IPM</span>,
    },
    row.is_local && {
      key: 'local',
      node: <span className="text-blue-600">Local</span>,
    },
    row.is_organic && {
      key: 'organic',
      node: <span className="text-green-600">Organic</span>,
    },
    row.is_waxed && {
      key: 'waxed',
      node: <span>Waxed</span>,
    },
  ].filter(Boolean) as { key: string; node: React.ReactNode }[];
  const hasAttributes = attributeElements.length > 0;
  const showUnavailable = row.is_unavailable && row.unavailable_since_date;
  const showNew = row.is_new;

  return (
    <tr
      onContextMenu={(e) => onContextMenu(e, row.name)}
      onTouchStart={(e) => onTouchStart(e, row.name)}
      onTouchEnd={() => onTouchEnd(row.name)}
      onTouchMove={(e) => onTouchMove(e, row.name)}
      onTouchCancel={() => onTouchCancel(row.name)}
      className={`group border-b border-zinc-100 select-none ${isSwiping ? (isFavorited ? 'bg-amber-50' : 'bg-white') : rowBaseClass}`}
      style={rowStyle}
    >
      <td
        ref={(el) => {
          if (!el) return;
          onMeasureNameCell(row.name, el.clientWidth);
        }}
        className={`${NAME_COL_CLASS} sticky left-0 z-10 box-border border-r border-zinc-200 p-0 md:w-auto md:border-r-0 ${
          isSwiping
            ? 'relative'
            : isPressed
              ? 'bg-zinc-100'
              : isFavorited
                ? 'bg-amber-50'
                : 'bg-white group-hover:bg-zinc-50 hover:bg-zinc-50'
        }`}
      >
        {isSwiping && swipeOffset > 0 && (
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
            <span
              className={`transition-all duration-150 ${thresholdReached ? 'scale-110 text-base' : 'scale-75 text-xs opacity-80'}`}
            >
              {revealIcon}
            </span>
          </div>
        )}
        {specialtyUrl && (
          <a
            href={specialtyUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute inset-0 z-10"
            aria-label={`View ${row.name} on Specialty Produce`}
          />
        )}
        <div
          className={`relative ${specialtyUrl ? 'z-20' : 'z-10'} flex h-full w-full items-center gap-1 p-2 text-left ${isSwiping ? swipeCoverClass : ''} ${specialtyUrl ? 'pointer-events-none' : ''}`}
          style={swipeStyle}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(row.name);
            }}
            className={`hidden h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px] font-bold md:inline-flex ${
              isFavorited
                ? 'border-zinc-200 bg-amber-100 text-amber-700'
                : 'border-zinc-200 bg-white text-zinc-400 hover:bg-amber-100 hover:text-amber-700'
            } ${specialtyUrl ? 'pointer-events-auto' : ''}`}
            aria-label={
              isFavorited ? `Remove ${row.name} from favorites` : `Add ${row.name} to favorites`
            }
          >
            {isFavorited ? '⭐' : '+'}
          </button>
          <div className="min-w-0">
            <div className="line-clamp-3 text-sm font-medium text-zinc-900 md:line-clamp-none">
              <span className={row.is_unavailable ? 'line-through' : undefined}>
                {specialtyUrl ? `${row.name} ↗` : row.name}
              </span>
            </div>
            <div className="text-xs text-zinc-500">
              {showUnavailable && (
                <span className="rounded bg-red-100 px-1 text-red-700">
                  <span className="inline-block">Out of stock</span>{' '}
                  <span className="inline-block">
                    {formatShortDate(row.unavailable_since_date!)}
                  </span>
                </span>
              )}
              {showUnavailable && showNew && ' · '}
              {showNew && (
                <span className="rounded bg-[rgb(255,246,220)] px-1 text-[#3F7540]">
                  <span className="inline-block">New arrival</span>
                  {row.first_seen_date && (
                    <>
                      {' '}
                      <span className="inline-block">{formatShortDate(row.first_seen_date)}</span>
                    </>
                  )}
                </span>
              )}
              {(showUnavailable || showNew) && hasAttributes && ' · '}
              {attributeElements.map((item, index) => (
                <span key={item.key}>
                  {item.node}
                  {index < attributeElements.length - 1 && ' · '}
                </span>
              ))}
            </div>
            {row.origin && <div className="text-xs text-zinc-400">{row.origin}</div>}
          </div>
        </div>
      </td>
      <td className={`p-2 font-mono text-zinc-900 ${DATA_COL_CLASS} box-border`}>
        <div className={isSwiping ? swipeCoverClass : ''} style={swipeStyle}>
          <div>
            <span className={`font-bold ${priceTrendClass}`}>${row.price.toFixed(2)}</span>
            {prev !== null && prev !== row.price && (
              <sup className="ml-1 text-[0.65em] text-zinc-400 line-through">
                ${prev.toFixed(2)}
              </sup>
            )}
          </div>
          <div className="text-xs text-zinc-500">/{row.unit}</div>
          <div className="mt-1">
            <Sparkline
              points={rowHistory}
              dateRange={dateRange}
              timePeriod={timePeriod}
              unavailableSinceDate={row.unavailable_since_date}
            />
          </div>
        </div>
      </td>
      <MetricsCell
        row={row}
        period={timePeriod}
        points={rowHistory}
        dateRange={dateRange}
        swipeStyle={swipeStyle}
        swipeCoverClass={isSwiping ? swipeCoverClass : ''}
      />
    </tr>
  );
});

function getPeriodPointCount(
  points: ProduceHistoryPoint[] | undefined,
  dateRange: ProduceDateRange | null,
  period: TimePeriod,
): number {
  if (!points || points.length === 0) return 0;

  const endMs = dateRange
    ? new Date(dateRange.end + 'T00:00:00').getTime()
    : new Date(points[points.length - 1].date + 'T00:00:00').getTime();

  const periodStartMs = getPeriodStartMs(period, endMs);

  return points.filter((point) => {
    const pointMs = new Date(point.date + 'T00:00:00').getTime();
    return pointMs >= periodStartMs && pointMs <= endMs;
  }).length;
}

function MetricsCell({
  row,
  period,
  points,
  dateRange,
  swipeStyle,
  swipeCoverClass,
}: {
  row: ProduceRow;
  period: TimePeriod;
  points?: ProduceHistoryPoint[];
  dateRange: ProduceDateRange | null;
  swipeStyle: React.CSSProperties;
  swipeCoverClass: string;
}) {
  const { prev, high, low } = getPeriodData(row, period, points, dateRange);
  const showHighLow = getPeriodPointCount(points, dateRange, period) >= 3;

  if (prev === null) {
    return (
      <td className={`relative p-2 ${DATA_COL_CLASS} box-border text-zinc-400`}>
        <div className={`relative z-10 ${swipeCoverClass}`} style={swipeStyle}>
          —
        </div>
      </td>
    );
  }

  const change = row.price - prev;
  const pctChange = (change / prev) * 100;
  const roundedPct = Math.round(pctChange * 10) / 10;

  const isPositive = change > 0;
  const isNegative = change < 0;

  const colorClass = isPositive ? 'text-red-600' : isNegative ? 'text-green-600' : 'text-zinc-500';

  const sign = isPositive ? '+' : isNegative ? '-' : '\u2007';

  return (
    <td className={`relative p-2 ${DATA_COL_CLASS} box-border text-xs tabular-nums`}>
      <div className={`relative z-10 ${swipeCoverClass}`} style={swipeStyle}>
        <div className="flex items-baseline gap-2 rounded bg-transparent px-1">
          <span className="w-10 shrink-0 text-zinc-500">% Diff</span>
          <span className={`w-20 text-right font-mono ${colorClass}`}>
            {sign}
            {Math.abs(roundedPct).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-baseline gap-2 rounded bg-transparent px-1">
          <span className="w-10 shrink-0 text-zinc-500">$ Diff</span>
          <span className={`w-20 text-right font-mono ${colorClass}`}>
            {sign}${Math.abs(change).toFixed(2)}
          </span>
        </div>
        <div
          className={`flex items-baseline gap-2 rounded px-1 ${showHighLow && high !== null && row.price === high && row.price !== low ? 'bg-red-100 text-zinc-900' : 'bg-transparent text-zinc-500'}`}
        >
          <span className="w-10 shrink-0">High</span>
          <span className="w-20 text-right font-mono">
            {showHighLow && high !== null ? `$${high.toFixed(2)}` : '—'}
          </span>
        </div>
        <div
          className={`flex items-baseline gap-2 rounded px-1 ${showHighLow && low !== null && row.price === low ? 'bg-green-100 text-zinc-900' : 'bg-transparent text-zinc-500'}`}
        >
          <span className="w-10 shrink-0">Low</span>
          <span className="w-20 text-right font-mono">
            {showHighLow && low !== null ? `$${low.toFixed(2)}` : '—'}
          </span>
        </div>
      </div>
    </td>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-zinc-100">
      <td
        className={`px-2 py-3 ${NAME_COL_CLASS} sticky left-0 z-10 box-border border-r border-zinc-200 bg-white md:w-auto md:border-r-0`}
      >
        <div className="space-y-1">
          <div className="feed-shimmer h-4 w-full rounded" />
          <div className="feed-shimmer h-3 w-2/3 rounded" />
        </div>
      </td>
      <td className={`px-2 py-3 ${DATA_COL_CLASS} box-border`}>
        <div className="flex h-full items-center">
          <div className="feed-shimmer h-4 w-full rounded" />
        </div>
      </td>
      <td className={`px-2 py-3 ${DATA_COL_CLASS} box-border`}>
        <div className="space-y-1">
          <div className="feed-shimmer h-3 w-20 rounded" />
          <div className="feed-shimmer h-3 w-16 rounded" />
          <div className="feed-shimmer h-3 w-18 rounded" />
          <div className="feed-shimmer h-3 w-18 rounded" />
        </div>
      </td>
    </tr>
  );
}

function Colgroup() {
  return (
    <colgroup>
      <col className={NAME_COL_CLASS} />
      <col className={DATA_COL_CLASS} />
      <col className={DATA_COL_CLASS} />
    </colgroup>
  );
}

function SortHeader({
  field,
  current,
  direction,
  onClick,
  className = '',
  children,
}: {
  field: SortField;
  current: SortField | null;
  direction: SortDirection;
  onClick: (field: SortField) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const isActive = field === current && direction !== null;
  return (
    <th
      className={`box-border cursor-pointer px-2 py-3 text-left font-medium whitespace-nowrap text-zinc-600 select-none hover:text-zinc-900 ${className}`}
      onClick={() => onClick(field)}
    >
      {children}
      <span className={`ml-1 inline-block w-3 ${isActive ? '' : 'invisible'}`}>
        {direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : ''}
      </span>
    </th>
  );
}

type PositionY = 'above' | 'baseline' | 'below';

function SparklineReadout({
  date,
  price,
  dimmed,
}: {
  date: string;
  price: number | null | undefined;
  dimmed?: boolean;
}) {
  return (
    <div
      className={`mb-0.5 inline-block rounded bg-black px-1.5 py-0.5 text-center text-[10px] text-white tabular-nums ${dimmed ? 'opacity-50' : ''}`}
    >
      {formatShortDateWithYear(date)} · {typeof price === 'number' ? `$${price.toFixed(2)}` : '—'}
    </div>
  );
}

function Sparkline({
  points,
  dateRange,
  timePeriod,
  unavailableSinceDate,
}: {
  points?: ProduceHistoryPoint[];
  dateRange: ProduceDateRange | null;
  timePeriod: TimePeriod;
  unavailableSinceDate?: string | null;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lastActiveIndex = useRef<number | null>(null);

  if (!points || points.length === 0) {
    return <div className="h-4 text-[10px] text-zinc-400">—</div>;
  }

  const width = 100;
  const height = 24;
  const padding = 3;
  const scaleEndMs = dateRange
    ? new Date(dateRange.end + 'T00:00:00').getTime()
    : new Date(points[points.length - 1].date + 'T00:00:00').getTime();
  const scaleStartMs = getScaleStartMs(timePeriod, scaleEndMs);

  const plottedPoints = points.filter((point) => {
    const pointMs = new Date(point.date + 'T00:00:00').getTime();
    return pointMs >= scaleStartMs && pointMs <= scaleEndMs;
  });

  const pointsInScale = downsampleForTimePeriod(
    plottedPoints.length > 0 ? plottedPoints : points,
    timePeriod,
  );
  const values = pointsInScale.map((point) => point.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  const startMs = scaleStartMs;
  const endMs = dateRange
    ? new Date(dateRange.end + 'T00:00:00').getTime()
    : new Date(points[points.length - 1].date + 'T00:00:00').getTime();
  const totalMs = endMs - startMs;

  const normalized = pointsInScale.map((point) => {
    const pointMs = new Date(point.date + 'T00:00:00').getTime();
    const x = (totalMs === 0 ? width / 2 : ((pointMs - startMs) / totalMs) * width) + padding;
    const y =
      (range === 0 ? height / 2 : height - ((point.price - min) / range) * height) + padding;
    return { x, y, pointMs };
  });

  const svgWidth = width + padding * 2;

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || normalized.length === 0) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgX = (e.clientX - ctm.e) / ctm.a;
    let closest = 0;
    let closestDist = Math.abs(normalized[0].x - svgX);
    for (let i = 1; i < normalized.length; i++) {
      const dist = Math.abs(normalized[i].x - svgX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    if (closestDist > 5) {
      setActiveIndex(null);
      lastActiveIndex.current = null;
      return;
    }
    setActiveIndex(closest);
    if (lastActiveIndex.current !== closest) {
      lastActiveIndex.current = closest;
      navigator.vibrate?.(1);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    handlePointerMove(e);
  };

  const handlePointerLeave = () => {
    setActiveIndex(null);
    lastActiveIndex.current = null;
  };

  const firstPoint = normalized[0];
  const lastPoint = normalized[normalized.length - 1];
  const baselineY = firstPoint?.y ?? height / 2 + padding;

  // Compute period start boundary
  const periodStartMs = getPeriodStartMs(timePeriod, endMs);
  const periodStartX =
    (totalMs === 0 ? width / 2 : ((periodStartMs - startMs) / totalMs) * width) + padding;

  // Find the period start data point
  const periodStartPoint = (() => {
    if (normalized.length < 2) return null;
    let closest = normalized[0];
    let closestDist = Infinity;
    for (const [index, point] of pointsInScale.entries()) {
      const pointMs = new Date(point.date + 'T00:00:00').getTime();
      const dist = Math.abs(pointMs - periodStartMs);
      const normPoint = normalized[index];
      if (dist < closestDist) {
        closestDist = dist;
        closest = normPoint;
      }
    }
    return closest;
  })();

  const lineSegments: { d: string; position: PositionY }[] = [];
  const areaSegments: { d: string; position: PositionY }[] = [];
  const missingGapRanges: { startX: number; endX: number }[] = [];
  const positionY = (point: { y: number }): PositionY =>
    point.y === baselineY ? 'baseline' : point.y < baselineY ? 'above' : 'below';
  const formatPoint = (point: { x: number; y: number }) =>
    `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;

  if (normalized.length > 1) {
    const gapThresholdMs = getConnectedGapThresholdMs(timePeriod);
    const contiguousChunks: (typeof normalized)[] = [];
    let activeChunk = [normalized[0]];
    for (let i = 1; i < normalized.length; i += 1) {
      const prevPoint = normalized[i - 1];
      const currentPoint = normalized[i];
      const gapMs = currentPoint.pointMs - prevPoint.pointMs;
      if (gapMs > gapThresholdMs) {
        contiguousChunks.push(activeChunk);
        activeChunk = [currentPoint];
        missingGapRanges.push({ startX: prevPoint.x, endX: currentPoint.x });
        continue;
      }
      activeChunk.push(currentPoint);
    }
    contiguousChunks.push(activeChunk);

    for (const chunk of contiguousChunks) {
      if (chunk.length < 2) continue;

      let currentPoints: { x: number; y: number }[] = [];
      let currentPosition: PositionY | null = null;

      const pushAreaSegment = () => {
        if (currentPosition === null || currentPoints.length < 2) return;
        const start = currentPoints[0];
        const end = currentPoints[currentPoints.length - 1];
        const line = currentPoints.map((point) => `L ${formatPoint(point)}`).join(' ');
        const d = `M ${start.x.toFixed(2)} ${baselineY.toFixed(2)} ${line} L ${end.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
        areaSegments.push({ d, position: currentPosition });
      };

      const pushLineSegment = () => {
        if (currentPosition === null || currentPoints.length < 2) return;
        const line = currentPoints.map(
          (point, index) => `${index === 0 ? 'M' : 'L'} ${formatPoint(point)}`,
        );
        lineSegments.push({ d: line.join(' '), position: currentPosition });
      };

      for (let i = 1; i < chunk.length; i += 1) {
        const prev = chunk[i - 1];
        const curr = chunk[i];
        const prevPos = positionY(prev);
        const currPos = positionY(curr);

        if (prevPos === 'baseline' && currPos === 'baseline') {
          // Flush any existing colored segment first
          pushAreaSegment();
          pushLineSegment();
          currentPoints = [];
          currentPosition = null;
          // Push a baseline line segment (grey, no area fill needed)
          lineSegments.push({
            d: `M ${formatPoint(prev)} L ${formatPoint(curr)}`,
            position: 'baseline',
          });
          continue;
        }

        const segmentPos = prevPos !== 'baseline' ? prevPos : currPos;
        if (currentPosition === null) {
          currentPosition = segmentPos;
        }
        if (currentPoints.length === 0) {
          currentPoints.push(prev);
        }

        if (
          (prevPos === 'above' && currPos === 'below') ||
          (prevPos === 'below' && currPos === 'above')
        ) {
          const t = (baselineY - prev.y) / (curr.y - prev.y);
          const intersection = {
            x: prev.x + t * (curr.x - prev.x),
            y: baselineY,
          };
          currentPoints.push(intersection);
          pushAreaSegment();
          pushLineSegment();
          currentPoints = [intersection, curr];
          currentPosition = currPos;
        } else {
          currentPoints.push(curr);
        }
      }

      pushAreaSegment();
      pushLineSegment();
    }
  }

  const activePoint =
    activeIndex !== null &&
    activeIndex >= 0 &&
    activeIndex < normalized.length &&
    activeIndex < pointsInScale.length
      ? { svg: normalized[activeIndex], data: pointsInScale[activeIndex] }
      : null;
  const hatchEndX = Math.max(periodStartX, padding, firstPoint?.x ?? padding);

  const isOutOfRange =
    activePoint &&
    (activePoint.svg.x < hatchEndX ||
      (unavailableSinceDate &&
        lastPoint &&
        lastPoint.x < width + padding &&
        activePoint.svg.x >= lastPoint.x));

  return (
    <div className="relative" data-sparkline-interactive="true">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgWidth} ${height + padding * 2}`}
        className="mx-auto h-6 touch-none"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerLeave}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerLeave}
      >
        <defs>
          <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse">
            <line
              x1="0"
              y1="4"
              x2="4"
              y2="0"
              stroke="#52525b"
              strokeWidth="0.5"
              strokeOpacity="0.8"
            />
          </pattern>
        </defs>
        {missingGapRanges.map((gap, index) => (
          <rect
            key={`gap-${index}`}
            x={gap.startX}
            y={0}
            width={Math.max(0, gap.endX - gap.startX)}
            height={height + padding * 2}
            fill="url(#hatch)"
          />
        ))}
        {areaSegments.map((segment, index) => (
          <path
            key={`area-${segment.position}-${index}`}
            d={segment.d}
            className={segment.position === 'above' ? 'fill-red-500/20' : 'fill-green-500/20'}
          />
        ))}
        {lineSegments.map((segment, index) => (
          <path
            key={`line-${segment.position}-${index}`}
            d={segment.d}
            className={
              { above: 'stroke-red-500', below: 'stroke-green-500', baseline: 'stroke-zinc-400' }[
                segment.position
              ]
            }
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {firstPoint && (
          <line
            x1={padding}
            x2={width + padding}
            y1={firstPoint.y}
            y2={firstPoint.y}
            className="stroke-black"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}
        {hatchEndX > padding && (
          <rect
            x={padding}
            y={0}
            width={hatchEndX - padding}
            height={height + padding * 2}
            fill="url(#hatch)"
          />
        )}
        {unavailableSinceDate && lastPoint && lastPoint.x < width + padding && (
          <rect
            x={lastPoint.x}
            y={0}
            width={width + padding - lastPoint.x}
            height={height + padding * 2}
            fill="url(#hatch)"
          />
        )}
        {periodStartPoint && (
          <circle
            cx={periodStartPoint.x}
            cy={periodStartPoint.y}
            r="2.25"
            className={
              {
                above: 'fill-white stroke-red-500',
                below: 'fill-white stroke-green-500',
                baseline: 'fill-white stroke-zinc-400',
              }[positionY(periodStartPoint)]
            }
            strokeWidth="1.5"
          />
        )}
        {lastPoint && (
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="2.75"
            className={
              { above: 'fill-red-500', below: 'fill-green-500', baseline: 'fill-zinc-400' }[
                positionY(lastPoint)
              ]
            }
            strokeWidth="0"
          />
        )}
        {activePoint && (
          <g opacity={isOutOfRange ? 0.5 : 1}>
            <line
              x1={activePoint.svg.x}
              x2={activePoint.svg.x}
              y1={0}
              y2={height + padding * 2}
              className="stroke-zinc-500"
              strokeWidth="0.75"
              strokeDasharray="2 2"
            />
            <circle
              cx={activePoint.svg.x}
              cy={activePoint.svg.y}
              r="3"
              className="fill-white stroke-zinc-700"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>
      <div className="mt-0.5 h-3">
        {activePoint && (
          <SparklineReadout
            date={activePoint.data.date}
            price={activePoint.data.price}
            dimmed={!!isOutOfRange}
          />
        )}
      </div>
    </div>
  );
}

function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatShortDateWithYear(isoDate: string): string {
  const date = new Date(isoDate + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}
