'use client';

import { useState, useMemo } from 'react';
import type { ProduceRow } from '@/lib/use-produce-data';

type SortField =
  | 'name'
  | 'price'
  | 'day_change'
  | 'day_change_pct'
  | 'week_change'
  | 'month_change';
type SortDirection = 'asc' | 'desc' | null;

interface ProduceAnalyticsProps {
  data: ProduceRow[];
  isLoading?: boolean;
  error?: string | null;
}

type QuickFilter = 'drops' | 'increases' | 'new' | null;

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
    if (quickFilter === 'new') {
      result = result.filter((row) => row.is_new);
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
  }, [data, search, sortField, sortDirection, quickFilter]);

  const skeletonRows = useMemo(
    () => Array.from({ length: 8 }, (_, index) => `skeleton-${index}`),
    [],
  );

  const getDisplayName = (name: string) => (name.endsWith(' -') ? name.slice(0, -2) : name);

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
      if (filter === 'new') {
        // "New" filter keeps default name sort
        setSortField('name');
        setSortDirection('asc');
      } else {
        setSortField('day_change');
        setSortDirection(filter === 'drops' ? 'asc' : 'desc');
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleQuickFilter('drops')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
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
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              quickFilter === 'increases'
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
          >
            Price Increases
          </button>
        </div>
        <div>
          <button
            type="button"
            onClick={() => handleQuickFilter('new')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              quickFilter === 'new'
                ? 'bg-[rgb(255,246,220)] text-[#3F7540]'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
          >
            New Arrivals
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
                Change
              </SortHeader>
              <SortHeader
                field="day_change_pct"
                current={sortField}
                direction={sortDirection}
                onClick={handleSort}
                className={`${PRICE_COL_CLASS} snap-start`}
              >
                Change %
              </SortHeader>
              <SortHeader
                field="week_change"
                current={sortField}
                direction={sortDirection}
                onClick={handleSort}
                className={`${PRICE_COL_CLASS} snap-start md:w-20`}
              >
                Week
              </SortHeader>
              <SortHeader
                field="month_change"
                current={sortField}
                direction={sortDirection}
                onClick={handleSort}
                className={`${PRICE_COL_CLASS} snap-start md:w-20`}
              >
                Month
              </SortHeader>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? skeletonRows.map((rowId) => <SkeletonRow key={rowId} />)
              : filteredAndSorted.map((row) => (
                  <tr
                    key={row.raw_name}
                    className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/50"
                  >
                    <td
                      className={`h-24 py-3 pr-4 ${NAME_COL_CLASS} sticky left-0 z-10 box-border border-r border-zinc-200 bg-white md:w-auto md:border-r-0 dark:border-zinc-700 dark:bg-zinc-900`}
                    >
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {getDisplayName(row.name)}
                      </div>
                      <div className="h-4 text-xs text-zinc-500 dark:text-zinc-400">
                        {row.is_new && (
                          <span className="rounded bg-[rgb(255,246,220)] px-1 text-[#3F7540]">
                            New Arrival
                          </span>
                        )}
                        {row.is_new && (row.is_organic || row.is_local) && ' · '}
                        {row.is_organic && (
                          <span className="text-green-600 dark:text-green-400">Organic</span>
                        )}
                        {row.is_organic && row.is_local && ' · '}
                        {row.is_local && (
                          <span className="text-blue-600 dark:text-blue-400">Local</span>
                        )}
                      </div>
                    </td>
                    <td
                      className={`snap-start px-2 py-3 font-mono text-zinc-900 dark:text-zinc-100 ${PRIMARY_PRICE_COL_CLASS} box-border`}
                    >
                      ${row.price.toFixed(2)}
                      <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
                        /{row.unit}
                      </span>
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
        <div className="flex h-full items-center">
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
