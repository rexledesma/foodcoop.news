'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useScrollVisibility } from '@/components/ScrollVisibilityProvider';
import type {
  ProduceDateRange,
  ProduceHistoryMap,
  ProduceHistoryPoint,
  ProduceRow,
} from '@/lib/use-produce-data';

type TimePeriod = '1D' | '1W' | '1M';
type SortField = 'name' | 'price' | 'change' | 'first_seen' | 'last_seen';
type SortDirection = 'asc' | 'desc' | null;

interface ProduceAnalyticsProps {
  data: ProduceRow[];
  history: ProduceHistoryMap;
  dateRange: ProduceDateRange | null;
  isLoading?: boolean;
  error?: string | null;
}

type QuickFilter = 'favorites' | 'drops' | 'increases' | 'new' | 'recently_unavailable' | null;

const NAME_COL_CLASS = 'w-1/3 min-w-[33.333%] max-w-[33.333%] md:w-2/5 md:min-w-0 md:max-w-none';
const DATA_COL_CLASS = 'w-1/3 min-w-[33.333%] max-w-[33.333%] md:w-auto md:min-w-0 md:max-w-none';

const TIME_PERIODS: TimePeriod[] = ['1D', '1W', '1M'];
const PERIOD_LABELS: Record<TimePeriod, string> = { '1D': 'Day', '1W': 'Week', '1M': 'Month' };

function getPeriodData(row: ProduceRow, period: TimePeriod) {
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
  }
}

export function ProduceAnalytics({
  data,
  history,
  dateRange,
  isLoading = false,
  error = null,
}: ProduceAnalyticsProps) {
  const [initialFilters] = useState(() => {
    const firstVisit = {
      quickFilter: 'drops' as QuickFilter,
      timePeriod: '1D' as TimePeriod,
      sortField: 'change' as SortField | null,
      sortDirection: 'asc' as SortDirection,
    };
    if (typeof window === 'undefined') return firstVisit;
    try {
      const stored = localStorage.getItem('produce-filters');
      if (!stored) return firstVisit;
      return JSON.parse(stored) as typeof firstVisit;
    } catch {
      return firstVisit;
    }
  });
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(initialFilters.sortField);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialFilters.sortDirection);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(initialFilters.quickFilter);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(initialFilters.timePeriod);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    const stored = localStorage.getItem('produce-favorites');
    if (!stored) return new Set();
    try {
      const parsed = JSON.parse(stored) as string[];
      return new Set(parsed);
    } catch {
      return new Set();
    }
  });
  const { showSticky } = useScrollVisibility();
  const controlsRef = useRef<HTMLDivElement>(null);
  const [controlsHeight, setControlsHeight] = useState(0);

  useEffect(() => {
    localStorage.setItem(
      'produce-filters',
      JSON.stringify({ quickFilter, timePeriod, sortField, sortDirection }),
    );
  }, [quickFilter, timePeriod, sortField, sortDirection]);

  useEffect(() => {
    localStorage.setItem('produce-favorites', JSON.stringify(Array.from(favorites)));
    window.dispatchEvent(new Event('produce-favorites'));
  }, [favorites]);

  useEffect(() => {
    const element = controlsRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    const updateHeight = () => {
      setControlsHeight(element.offsetHeight);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const stickyVisible = showSticky || isSearchFocused;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('force-sticky', { detail: isSearchFocused }));
  }, [isSearchFocused]);

  const filteredAndSorted = useMemo(() => {
    let result = data;

    // Filter by search
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (row) => row.name.toLowerCase().includes(lower) || row.origin.toLowerCase().includes(lower),
      );
    }

    // Filter by quick filter
    if (quickFilter === 'favorites') {
      result = result.filter((row) => favorites.has(row.name));
    } else if (quickFilter === 'new') {
      result = result.filter((row) => row.is_new);
    } else if (quickFilter === 'recently_unavailable') {
      result = result.filter((row) => row.is_unavailable);
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
          const aPeriod = getPeriodData(a, timePeriod);
          const bPeriod = getPeriodData(b, timePeriod);
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
  }, [data, search, sortField, sortDirection, quickFilter, favorites, timePeriod]);

  const skeletonRows = useMemo(
    () => Array.from({ length: 8 }, (_, index) => `skeleton-${index}`),
    [],
  );

  const handleSort = (field: SortField) => {
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

    // Sync pills with sort state for change column
    if (!newField || !newDirection || newField === 'name' || newField === 'price') {
      setQuickFilter(null);
    } else if (newField === 'change') {
      setQuickFilter(newDirection === 'asc' ? 'drops' : 'increases');
    }
  };

  const handleQuickFilter = (filter: QuickFilter) => {
    if (quickFilter === filter) {
      // Clicking same filter again - reset to default
      setQuickFilter(null);
      setSortField('name');
      setSortDirection('asc');
    } else {
      setQuickFilter(filter);
      if (filter === 'drops' || filter === 'increases') {
        setSortField('change');
        setSortDirection(filter === 'drops' ? 'asc' : 'desc');
      } else if (filter === 'favorites') {
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
        className={`sticky top-24 z-20 bg-white transition-[opacity,transform] duration-300 ease-in-out motion-reduce:transition-none md:top-14 dark:bg-zinc-900 ${
          stickyVisible
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
      >
        <h1 className="py-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Produce</h1>
        {/* Search */}
        <div className="mb-4">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="Search produce..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 pr-10 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-sm text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            ) : null}
          </div>
          {!isLoading && (
            <div className="p-2 text-sm text-zinc-500 dark:text-zinc-400">
              Showing {filteredAndSorted.length} of {data.length} items
            </div>
          )}
        </div>

        {/* Quick Filters */}
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleQuickFilter('favorites')}
              className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                quickFilter === 'favorites'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
            >
              Favorites
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter('drops')}
              className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                quickFilter === 'drops'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
            >
              Price Drops
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter('increases')}
              className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                quickFilter === 'increases'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
            >
              Price Increases
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter('new')}
              className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                quickFilter === 'new'
                  ? 'bg-[rgb(255,246,220)] text-[#3F7540]'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
            >
              New Arrivals
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter('recently_unavailable')}
              className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                quickFilter === 'recently_unavailable'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>

        {/* Time Period Pills */}
        <div className="mb-4 flex gap-1">
          {TIME_PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setTimePeriod(period)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                timePeriod === period
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
            >
              {PERIOD_LABELS[period]}
            </button>
          ))}
        </div>

        {error && !isLoading && (
          <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        {/* Header table */}
        <table className="w-full min-w-full table-fixed text-sm">
          <Colgroup />
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <SortHeader
                field="name"
                current={sortField}
                direction={sortDirection}
                onClick={handleSort}
                className={`${NAME_COL_CLASS} sticky left-0 z-10 border-r border-zinc-200 bg-white md:border-r-0 dark:border-zinc-700 dark:bg-zinc-900`}
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
                {PERIOD_LABELS[timePeriod]}
              </SortHeader>
            </tr>
          </thead>
        </table>
      </div>

      {/* Body table */}
      <div
        className="transition-transform duration-300 ease-in-out motion-reduce:transition-none"
        style={{
          transform: stickyVisible ? 'translateY(0px)' : `translateY(-${controlsHeight}px)`,
        }}
      >
        <table className="w-full min-w-full table-fixed text-sm">
          <Colgroup />
          <tbody>
            {isLoading
              ? skeletonRows.map((rowId) => <SkeletonRow key={rowId} />)
              : filteredAndSorted.map((row) => (
                  <tr
                    key={row.name}
                    className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/50"
                  >
                    <td
                      className={`${NAME_COL_CLASS} sticky left-0 z-10 box-border border-r border-zinc-200 bg-white p-0 md:w-auto md:border-r-0 dark:border-zinc-700 dark:bg-zinc-900`}
                    >
                      <button
                        type="button"
                        aria-pressed={favorites.has(row.name)}
                        aria-label={`${
                          favorites.has(row.name) ? 'Remove from' : 'Add to'
                        } favorites for ${row.name}`}
                        onClick={() =>
                          setFavorites((previous) => {
                            const next = new Set(previous);
                            if (next.has(row.name)) {
                              next.delete(row.name);
                            } else {
                              next.add(row.name);
                            }
                            return next;
                          })
                        }
                        className="h-full w-full cursor-pointer p-2 text-left"
                      >
                        <div>
                          <span
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                              favorites.has(row.name)
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                            }`}
                          >
                            {favorites.has(row.name) ? '⭐' : '+'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            <span
                              className={[
                                'rounded px-1',
                                favorites.has(row.name) &&
                                  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                                row.is_unavailable && 'line-through',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              {row.name}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {(() => {
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
                                  node: (
                                    <span className="text-blue-600 dark:text-blue-400">Local</span>
                                  ),
                                },
                                row.is_organic && {
                                  key: 'organic',
                                  node: (
                                    <span className="text-green-600 dark:text-green-400">
                                      Organic
                                    </span>
                                  ),
                                },
                                row.is_waxed && {
                                  key: 'waxed',
                                  node: <span>Waxed</span>,
                                },
                              ].filter(Boolean) as { key: string; node: React.ReactNode }[];
                              const hasAttributes = attributeElements.length > 0;
                              const showUnavailable =
                                row.is_unavailable && row.unavailable_since_date;
                              const showNew = row.is_new;

                              return (
                                <>
                                  {showUnavailable && (
                                    <span className="rounded bg-red-100 px-1 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                      <span className="inline-block">Last seen</span>{' '}
                                      <span className="inline-block">
                                        {formatShortDate(row.unavailable_since_date!)}
                                      </span>
                                    </span>
                                  )}
                                  {showUnavailable && showNew && ' · '}
                                  {showNew && (
                                    <span className="rounded bg-[rgb(255,246,220)] px-1 text-[#3F7540]">
                                      <span className="inline-block">First seen</span>
                                      {row.first_seen_date && (
                                        <>
                                          {' '}
                                          <span className="inline-block">
                                            {formatShortDate(row.first_seen_date)}
                                          </span>
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
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </button>
                    </td>
                    <td
                      className={`p-2 font-mono text-zinc-900 dark:text-zinc-100 ${DATA_COL_CLASS} box-border`}
                    >
                      <div>
                        {(() => {
                          const { prev } = getPeriodData(row, timePeriod);
                          return (
                            <>
                              <span
                                className={`font-bold ${
                                  prev !== null && row.price < prev
                                    ? 'text-green-600 dark:text-green-400'
                                    : prev !== null && row.price > prev
                                      ? 'text-red-600 dark:text-red-400'
                                      : ''
                                }`}
                              >
                                ${row.price.toFixed(2)}
                              </span>
                              {prev !== null && prev !== row.price && (
                                <sup className="ml-1 text-[0.65em] text-zinc-400 line-through dark:text-zinc-500">
                                  ${prev.toFixed(2)}
                                </sup>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">/{row.unit}</div>
                      <div className="mt-1">
                        <Sparkline
                          points={history.get(row.name)}
                          dateRange={dateRange}
                          timePeriod={timePeriod}
                          unavailableSinceDate={row.unavailable_since_date}
                        />
                      </div>
                    </td>
                    <MetricsCell row={row} period={timePeriod} />
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricsCell({ row, period }: { row: ProduceRow; period: TimePeriod }) {
  const { prev, high, low } = getPeriodData(row, period);

  if (prev === null) {
    return <td className={`p-2 ${DATA_COL_CLASS} box-border text-zinc-400`}>—</td>;
  }

  const change = row.price - prev;
  const pctChange = (change / prev) * 100;
  const roundedPct = Math.round(pctChange * 10) / 10;

  const isPositive = change > 0;
  const isNegative = change < 0;

  const colorClass = isPositive
    ? 'text-red-600 dark:text-red-400'
    : isNegative
      ? 'text-green-600 dark:text-green-400'
      : 'text-zinc-500';

  const sign = isPositive ? '+' : isNegative ? '-' : '\u2007';

  return (
    <td className={`p-2 ${DATA_COL_CLASS} box-border text-xs tabular-nums`}>
      <div className="flex items-baseline gap-2 rounded bg-transparent px-1">
        <span className="w-10 shrink-0 text-zinc-500 dark:text-zinc-400">% Diff</span>
        <span className={`w-20 text-right font-mono ${colorClass}`}>
          {sign}
          {Math.abs(roundedPct).toFixed(1)}%
        </span>
      </div>
      <div className="flex items-baseline gap-2 rounded bg-transparent px-1">
        <span className="w-10 shrink-0 text-zinc-500 dark:text-zinc-400">$ Diff</span>
        <span className={`w-20 text-right font-mono ${colorClass}`}>
          {sign}${Math.abs(change).toFixed(2)}
        </span>
      </div>
      <div
        className={`flex items-baseline gap-2 rounded px-1 ${high !== null && row.price === high && row.price !== low ? 'bg-red-100 text-zinc-900 dark:bg-red-900/40 dark:text-zinc-100' : 'bg-transparent text-zinc-500'}`}
      >
        <span className="w-10 shrink-0">High</span>
        <span className="w-20 text-right font-mono">
          {high !== null ? `$${high.toFixed(2)}` : '—'}
        </span>
      </div>
      <div
        className={`flex items-baseline gap-2 rounded px-1 ${low !== null && row.price === low ? 'bg-green-100 text-zinc-900 dark:bg-green-900/40 dark:text-zinc-100' : 'bg-transparent text-zinc-500'}`}
      >
        <span className="w-10 shrink-0">Low</span>
        <span className="w-20 text-right font-mono">
          {low !== null ? `$${low.toFixed(2)}` : '—'}
        </span>
      </div>
    </td>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800/50">
      <td
        className={`px-2 py-3 ${NAME_COL_CLASS} sticky left-0 z-10 box-border border-r border-zinc-200 bg-white md:w-auto md:border-r-0 dark:border-zinc-700 dark:bg-zinc-900`}
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
      className={`box-border cursor-pointer px-2 py-3 text-left font-medium whitespace-nowrap text-zinc-600 select-none hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 ${className}`}
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
  if (!points || points.length === 0) {
    return <div className="h-4 text-[10px] text-zinc-400">—</div>;
  }

  const width = 100;
  const height = 24;
  const padding = 3;
  const values = points.map((point) => point.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  const startMs = dateRange
    ? new Date(dateRange.start + 'T00:00:00').getTime()
    : new Date(points[0].date + 'T00:00:00').getTime();
  const endMs = dateRange
    ? new Date(dateRange.end + 'T00:00:00').getTime()
    : new Date(points[points.length - 1].date + 'T00:00:00').getTime();
  const totalMs = endMs - startMs;

  const normalized = points.map((point) => {
    const pointMs = new Date(point.date + 'T00:00:00').getTime();
    const x = (totalMs === 0 ? width / 2 : ((pointMs - startMs) / totalMs) * width) + padding;
    const y =
      (range === 0 ? height / 2 : height - ((point.price - min) / range) * height) + padding;
    return { x, y };
  });

  const firstPoint = normalized[0];
  const lastPoint = normalized[normalized.length - 1];
  const baselineY = firstPoint?.y ?? height / 2 + padding;

  // Compute period start boundary
  const periodStartMs =
    timePeriod === '1D'
      ? endMs - 1 * 24 * 60 * 60 * 1000
      : timePeriod === '1W'
        ? endMs - 7 * 24 * 60 * 60 * 1000
        : startMs;
  const periodStartX =
    (totalMs === 0 ? width / 2 : ((periodStartMs - startMs) / totalMs) * width) + padding;

  // Find the period start data point
  const periodStartPoint = (() => {
    if (normalized.length < 2) return null;
    if (timePeriod === '1D') return normalized[normalized.length - 2];
    if (timePeriod === '1M') return normalized[0];
    // 1W: find closest point to periodStartMs
    let closest = normalized[0];
    let closestDist = Infinity;
    for (const point of points) {
      const pointMs = new Date(point.date + 'T00:00:00').getTime();
      const dist = Math.abs(pointMs - periodStartMs);
      const normPoint = normalized[points.indexOf(point)];
      if (dist < closestDist) {
        closestDist = dist;
        closest = normPoint;
      }
    }
    return closest;
  })();

  const lineSegments: { d: string; position: PositionY }[] = [];
  const areaSegments: { d: string; position: PositionY }[] = [];
  const positionY = (point: { y: number }): PositionY =>
    point.y === baselineY ? 'baseline' : point.y < baselineY ? 'above' : 'below';
  const formatPoint = (point: { x: number; y: number }) =>
    `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;

  if (normalized.length > 1) {
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

    for (let i = 1; i < normalized.length; i += 1) {
      const prev = normalized[i - 1];
      const curr = normalized[i];
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

  return (
    <svg
      viewBox={`0 0 ${width + padding * 2} ${height + padding * 2}`}
      className="h-6 w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
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
      {(() => {
        const hatchEndX = Math.max(
          timePeriod !== '1M' ? periodStartX : padding,
          firstPoint?.x ?? padding,
        );
        return (
          hatchEndX > padding && (
            <rect
              x={padding}
              y={0}
              width={hatchEndX - padding}
              height={height + padding * 2}
              fill="url(#hatch)"
            />
          )
        );
      })()}
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
    </svg>
  );
}

function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
