'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProduceRow } from '@/lib/use-produce-data';

type SortField =
  | 'name'
  | 'price'
  | 'day_change'
  | 'day_change_pct'
  | 'week_change'
  | 'month_change'
  | 'first_seen'
  | 'last_seen';
type SortDirection = 'asc' | 'desc' | null;

interface ProduceAnalyticsProps {
  data: ProduceRow[];
  isLoading?: boolean;
  error?: string | null;
}

type QuickFilter =
  | 'favorites'
  | 'drops'
  | 'increases'
  | 'new'
  | 'recently_unavailable'
  | 'hydroponic'
  | 'ipm'
  | 'local'
  | 'organic'
  | 'waxed'
  | null;

const PRICE_COL_CLASS =
  'w-[var(--price-col)] min-w-[var(--price-col)] max-w-[var(--price-col)] md:w-24 md:min-w-0 md:max-w-none';
const PRIMARY_PRICE_COL_CLASS =
  'w-[var(--price-col)] min-w-[var(--price-col)] max-w-[var(--price-col)] md:w-28 md:min-w-0 md:max-w-none';
const NAME_COL_CLASS =
  'w-[var(--name-col)] min-w-[var(--name-col)] max-w-[var(--name-col)] md:w-2/5 md:min-w-0 md:max-w-none';

export function ProduceAnalytics({ data, isLoading = false, error = null }: ProduceAnalyticsProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField | null>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
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

  useEffect(() => {
    localStorage.setItem('produce-favorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

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
    } else if (quickFilter === 'hydroponic') {
      result = result.filter((row) => row.is_hydroponic);
    } else if (quickFilter === 'ipm') {
      result = result.filter((row) => row.is_ipm);
    } else if (quickFilter === 'local') {
      result = result.filter((row) => row.is_local);
    } else if (quickFilter === 'organic') {
      result = result.filter((row) => row.is_organic);
    } else if (quickFilter === 'waxed') {
      result = result.filter((row) => row.is_waxed);
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
        case 'day_change':
          aVal = a.prev_day_price ? a.price - a.prev_day_price : 0;
          bVal = b.prev_day_price ? b.price - b.prev_day_price : 0;
          break;
        case 'day_change_pct':
          aVal = a.prev_day_price ? (a.price - a.prev_day_price) / a.prev_day_price : 0;
          bVal = b.prev_day_price ? (b.price - b.prev_day_price) / b.prev_day_price : 0;
          break;
        case 'week_change':
          aVal = a.prev_week_price ? (a.price - a.prev_week_price) / a.prev_week_price : 0;
          bVal = b.prev_week_price ? (b.price - b.prev_week_price) / b.prev_week_price : 0;
          break;
        case 'month_change':
          aVal = a.prev_month_price ? (a.price - a.prev_month_price) / a.prev_month_price : 0;
          bVal = b.prev_month_price ? (b.price - b.prev_month_price) / b.prev_month_price : 0;
          break;
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
  }, [data, search, sortField, sortDirection, quickFilter, favorites]);

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

    // Sync pills with sort state for change columns
    if (!newField || !newDirection || newField === 'name' || newField === 'price') {
      setQuickFilter(null);
    } else {
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
        setSortField('day_change');
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
      } else {
        // Attribute filters keep default name sort
        setSortField('name');
        setSortDirection('asc');
      }
    }
  };

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search produce..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleQuickFilter('hydroponic')}
            className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              quickFilter === 'hydroponic'
                ? 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
          >
            Hydroponic
          </button>
          <button
            type="button"
            onClick={() => handleQuickFilter('ipm')}
            className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              quickFilter === 'ipm'
                ? 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
          >
            IPM
          </button>
          <button
            type="button"
            onClick={() => handleQuickFilter('local')}
            className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              quickFilter === 'local'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
          >
            Local
          </button>
          <button
            type="button"
            onClick={() => handleQuickFilter('organic')}
            className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              quickFilter === 'organic'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
          >
            Organic
          </button>
          <button
            type="button"
            onClick={() => handleQuickFilter('waxed')}
            className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              quickFilter === 'waxed'
                ? 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
          >
            Waxed
          </button>
        </div>
      </div>

      {error && !isLoading && (
        <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {/* Table */}
      <div className="snap-x snap-mandatory scroll-pl-[var(--name-col)] overflow-x-auto [--name-col:10rem] [--price-col:calc((100dvw-2rem-var(--name-col))/2)] md:snap-none md:scroll-pl-0">
        <table className="w-full min-w-full table-fixed text-sm">
          <colgroup>
            <col className={NAME_COL_CLASS} />
            <col className={PRIMARY_PRICE_COL_CLASS} />
            <col className={PRICE_COL_CLASS} />
            <col className={PRICE_COL_CLASS} />
            <col className={`${PRICE_COL_CLASS} md:w-20`} />
            <col className={`${PRICE_COL_CLASS} md:w-20`} />
          </colgroup>
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
                className={`${PRIMARY_PRICE_COL_CLASS} snap-start`}
              >
                Price
              </SortHeader>
              <SortHeader
                field="day_change"
                current={sortField}
                direction={sortDirection}
                onClick={handleSort}
                className={`${PRICE_COL_CLASS} snap-start`}
              >
                Day Δ
              </SortHeader>
              <SortHeader
                field="day_change_pct"
                current={sortField}
                direction={sortDirection}
                onClick={handleSort}
                className={`${PRICE_COL_CLASS} snap-start`}
              >
                Day %
              </SortHeader>
              <SortHeader
                field="week_change"
                current={sortField}
                direction={sortDirection}
                onClick={handleSort}
                className={`${PRICE_COL_CLASS} snap-start md:w-20`}
              >
                Week %
              </SortHeader>
              <SortHeader
                field="month_change"
                current={sortField}
                direction={sortDirection}
                onClick={handleSort}
                className={`${PRICE_COL_CLASS} snap-start md:w-20`}
              >
                Month %
              </SortHeader>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? skeletonRows.map((rowId) => <SkeletonRow key={rowId} />)
              : filteredAndSorted.map((row) => (
                  <tr
                    key={row.name}
                    className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/50"
                  >
                    <td
                      className={`h-24 py-3 pr-4 ${NAME_COL_CLASS} sticky left-0 z-10 box-border border-r border-zinc-200 bg-white md:w-auto md:border-r-0 dark:border-zinc-700 dark:bg-zinc-900`}
                    >
                      <div className="flex items-center gap-2">
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
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[0.7rem] font-bold transition-colors ${
                            favorites.has(row.name)
                              ? 'border-amber-400 bg-amber-100 text-amber-700 dark:border-amber-400/60 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {favorites.has(row.name) ? '⭐' : '+'}
                        </button>
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {row.name}
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
                                      Last seen {formatShortDate(row.unavailable_since_date!)}
                                    </span>
                                  )}
                                  {showUnavailable && showNew && ' · '}
                                  {showNew && (
                                    <span className="rounded bg-[rgb(255,246,220)] px-1 text-[#3F7540]">
                                      First seen
                                      {row.first_seen_date &&
                                        ` ${formatShortDate(row.first_seen_date)}`}
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
                      </div>
                    </td>
                    <td
                      className={`snap-start px-2 py-3 font-mono text-zinc-900 dark:text-zinc-100 ${PRIMARY_PRICE_COL_CLASS} box-border`}
                    >
                      <div>
                        <span
                          className={`font-bold ${
                            row.prev_day_price !== null && row.price < row.prev_day_price
                              ? 'text-green-600 dark:text-green-400'
                              : row.prev_day_price !== null && row.price > row.prev_day_price
                                ? 'text-red-600 dark:text-red-400'
                                : ''
                          }`}
                        >
                          ${row.price.toFixed(2)}
                        </span>
                        {row.prev_day_price !== null && row.prev_day_price !== row.price && (
                          <sup className="ml-1 text-[0.65em] text-zinc-400 line-through dark:text-zinc-500">
                            ${row.prev_day_price.toFixed(2)}
                          </sup>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">/{row.unit}</div>
                    </td>
                    <AbsoluteChangeCell current={row.price} previous={row.prev_day_price} />
                    <PercentChangeCell current={row.price} previous={row.prev_day_price} />
                    <PercentChangeCell current={row.price} previous={row.prev_week_price} />
                    <PercentChangeCell current={row.price} previous={row.prev_month_price} />
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!isLoading && (
        <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Showing {filteredAndSorted.length} of {data.length} items
        </div>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800/50">
      <td
        className={`h-24 py-3 pr-4 ${NAME_COL_CLASS} sticky left-0 z-10 box-border border-r border-zinc-200 bg-white md:w-auto md:border-r-0 dark:border-zinc-700 dark:bg-zinc-900`}
      >
        <div className="flex h-full items-center gap-2">
          <div className="feed-shimmer h-5 w-5 rounded" />
          <div className="feed-shimmer h-4 w-full rounded" />
        </div>
      </td>
      <td className={`snap-start px-2 py-3 ${PRIMARY_PRICE_COL_CLASS} box-border`}>
        <div className="flex h-full items-center">
          <div className="feed-shimmer h-4 w-full rounded" />
        </div>
      </td>
      <td className={`snap-start px-2 py-3 ${PRICE_COL_CLASS} box-border`}>
        <div className="flex h-full items-center">
          <div className="feed-shimmer h-4 w-full rounded" />
        </div>
      </td>
      <td className={`snap-start px-2 py-3 ${PRICE_COL_CLASS} box-border`}>
        <div className="flex h-full items-center">
          <div className="feed-shimmer h-4 w-full rounded" />
        </div>
      </td>
      <td className={`snap-start px-2 py-3 ${PRICE_COL_CLASS} box-border`}>
        <div className="flex h-full items-center">
          <div className="feed-shimmer h-4 w-full rounded" />
        </div>
      </td>
      <td className={`snap-start px-2 py-3 ${PRICE_COL_CLASS} box-border`}>
        <div className="flex h-full items-center">
          <div className="feed-shimmer h-4 w-full rounded" />
        </div>
      </td>
    </tr>
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

function AbsoluteChangeCell({ current, previous }: { current: number; previous: number | null }) {
  const baseClass = `py-3 px-2 snap-start ${PRICE_COL_CLASS} box-border`;

  if (previous === null) {
    return <td className={`${baseClass} text-zinc-400`}>—</td>;
  }

  const change = current - previous;
  const isPositive = change > 0;
  const isNegative = change < 0;

  const colorClass = isPositive
    ? 'text-red-600 dark:text-red-400'
    : isNegative
      ? 'text-green-600 dark:text-green-400'
      : 'text-zinc-500';

  const sign = isPositive ? '+' : isNegative ? '-' : '\u2007';

  return (
    <td className={`${baseClass} font-mono ${colorClass}`}>
      {sign}${Math.abs(change).toFixed(2)}
    </td>
  );
}

function PercentChangeCell({ current, previous }: { current: number; previous: number | null }) {
  const baseClass = `py-3 px-2 snap-start ${PRICE_COL_CLASS} box-border`;

  if (previous === null) {
    return <td className={`${baseClass} text-zinc-400`}>—</td>;
  }

  const change = current - previous;
  const pctChange = (change / previous) * 100;
  const roundedPct = Math.round(pctChange * 10) / 10;

  const isPositive = roundedPct > 0;
  const isNegative = roundedPct < 0;

  const colorClass = isPositive
    ? 'text-red-600 dark:text-red-400'
    : isNegative
      ? 'text-green-600 dark:text-green-400'
      : 'text-zinc-500';

  const sign = isPositive ? '+' : isNegative ? '-' : '\u2007';

  return (
    <td className={`${baseClass} font-mono ${colorClass}`}>
      {sign}
      {Math.abs(roundedPct).toFixed(1)}%
    </td>
  );
}

function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
