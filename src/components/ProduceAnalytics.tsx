"use client";

import { useState, useMemo } from "react";
import type { ProduceRow } from "@/lib/use-produce-data";

type SortField =
  | "name"
  | "price"
  | "day_change"
  | "day_change_pct"
  | "week_change"
  | "month_change";
type SortDirection = "asc" | "desc";

interface ProduceAnalyticsProps {
  data: ProduceRow[];
}

type QuickFilter = "drops" | "increases" | null;

const PRICE_COL_CLASS =
  "w-[var(--price-col)] min-w-[var(--price-col)] max-w-[var(--price-col)] md:w-24 md:min-w-0 md:max-w-none";
const NAME_COL_CLASS =
  "w-[var(--name-col)] min-w-[var(--name-col)] max-w-[var(--name-col)] md:w-1/2 md:min-w-0 md:max-w-none";

export function ProduceAnalytics({ data }: ProduceAnalyticsProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);

  const filteredAndSorted = useMemo(() => {
    let result = data;

    // Filter by search
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (row) =>
          row.name.toLowerCase().includes(lower) ||
          row.origin.toLowerCase().includes(lower),
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case "name":
          aVal = a.name;
          bVal = b.name;
          break;
        case "price":
          aVal = a.price;
          bVal = b.price;
          break;
        case "day_change":
          aVal = a.prev_day_price ? a.price - a.prev_day_price : 0;
          bVal = b.prev_day_price ? b.price - b.prev_day_price : 0;
          break;
        case "day_change_pct":
          aVal = a.prev_day_price
            ? (a.price - a.prev_day_price) / a.prev_day_price
            : 0;
          bVal = b.prev_day_price
            ? (b.price - b.prev_day_price) / b.prev_day_price
            : 0;
          break;
        case "week_change":
          aVal = a.prev_week_price
            ? (a.price - a.prev_week_price) / a.prev_week_price
            : 0;
          bVal = b.prev_week_price
            ? (b.price - b.prev_week_price) / b.prev_week_price
            : 0;
          break;
        case "month_change":
          aVal = a.prev_month_price
            ? (a.price - a.prev_month_price) / a.prev_month_price
            : 0;
          bVal = b.prev_month_price
            ? (b.price - b.prev_month_price) / b.prev_month_price
            : 0;
          break;
        default:
          return 0;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [data, search, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    let newDirection: SortDirection;
    if (sortField === field) {
      newDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      newDirection = "asc";
    }

    setSortField(field);
    setSortDirection(newDirection);

    // Sync pills with sort state for change columns
    if (field === "name" || field === "price") {
      setQuickFilter(null);
    } else {
      setQuickFilter(newDirection === "asc" ? "drops" : "increases");
    }
  };

  const handleQuickFilter = (filter: QuickFilter) => {
    if (quickFilter === filter) {
      // Clicking same filter again - reset to default
      setQuickFilter(null);
      setSortField("name");
      setSortDirection("asc");
    } else {
      setQuickFilter(filter);
      setSortField("day_change");
      setSortDirection(filter === "drops" ? "asc" : "desc");
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
          className="w-full max-w-md px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500"
        />
      </div>

      {/* Quick Filters */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => handleQuickFilter("drops")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            quickFilter === "drops"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          }`}
        >
          Price Drops
        </button>
        <button
          type="button"
          onClick={() => handleQuickFilter("increases")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            quickFilter === "increases"
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          }`}
        >
          Price Increases
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto snap-x snap-mandatory md:snap-none scroll-pl-[var(--name-col)] md:scroll-pl-0 [--name-col:10rem] [--price-col:calc((100dvw-2rem-var(--name-col))/2)]">
        <table className="text-sm table-fixed">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <SortHeader
                field="name"
                current={sortField}
                direction={sortDirection}
                onClick={handleSort}
                className={`${NAME_COL_CLASS} sticky left-0 z-10 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700 md:border-r-0`}
              >
                Name
              </SortHeader>
              <SortHeader
                field="price"
                current={sortField}
                direction={sortDirection}
                onClick={handleSort}
                className={`${PRICE_COL_CLASS} snap-start`}
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
                className={`${PRICE_COL_CLASS} md:w-20 snap-start`}
              >
                Week
              </SortHeader>
              <SortHeader
                field="month_change"
                current={sortField}
                direction={sortDirection}
                onClick={handleSort}
                className={`${PRICE_COL_CLASS} md:w-20 snap-start`}
              >
                Month
              </SortHeader>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((row) => (
              <tr
                key={row.raw_name}
                className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <td className={`py-3 pr-4 h-24 ${NAME_COL_CLASS} md:w-auto sticky left-0 z-10 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700 md:border-r-0 box-border`}>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {row.name}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 h-4">
                    {row.is_organic && (
                      <span className="text-green-600 dark:text-green-400">
                        Organic
                      </span>
                    )}
                    {row.is_organic && row.is_local && " · "}
                    {row.is_local && (
                      <span className="text-blue-600 dark:text-blue-400">
                        Local
                      </span>
                    )}
                  </div>
                </td>
                <td className={`py-3 px-2 font-mono text-zinc-900 dark:text-zinc-100 snap-start ${PRICE_COL_CLASS} box-border`}>
                  ${row.price.toFixed(2)}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-1">
                    /{row.unit}
                  </span>
                </td>
                <AbsoluteChangeCell
                  current={row.price}
                  previous={row.prev_day_price}
                />
                <PercentChangeCell
                  current={row.price}
                  previous={row.prev_day_price}
                />
                <PercentChangeCell
                  current={row.price}
                  previous={row.prev_week_price}
                />
                <PercentChangeCell
                  current={row.price}
                  previous={row.prev_month_price}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        Showing {filteredAndSorted.length} of {data.length} items
      </div>
    </div>
  );
}

function SortHeader({
  field,
  current,
  direction,
  onClick,
  className = "",
  children,
}: {
  field: SortField;
  current: SortField;
  direction: SortDirection;
  onClick: (field: SortField) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const isActive = field === current;
  return (
    <th
      className={`py-3 px-2 font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200 select-none whitespace-nowrap text-left box-border ${className}`}
      onClick={() => onClick(field)}
    >
      {children}
      <span className={`ml-1 inline-block w-3 ${isActive ? "" : "invisible"}`}>
        {direction === "asc" ? "↑" : "↓"}
      </span>
    </th>
  );
}

function AbsoluteChangeCell({
  current,
  previous,
}: {
  current: number;
  previous: number | null;
}) {
  const baseClass = `py-3 px-2 snap-start ${PRICE_COL_CLASS} box-border`;

  if (previous === null) {
    return <td className={`${baseClass} text-zinc-400`}>—</td>;
  }

  const change = current - previous;
  const isPositive = change > 0;
  const isNegative = change < 0;

  const colorClass = isPositive
    ? "text-red-600 dark:text-red-400"
    : isNegative
      ? "text-green-600 dark:text-green-400"
      : "text-zinc-500";

  const sign = isPositive ? "+" : isNegative ? "-" : "\u2007";

  return (
    <td className={`${baseClass} font-mono ${colorClass}`}>
      {sign}${Math.abs(change).toFixed(2)}
    </td>
  );
}

function PercentChangeCell({
  current,
  previous,
}: {
  current: number;
  previous: number | null;
}) {
  const baseClass = `py-3 px-2 snap-start ${PRICE_COL_CLASS} box-border`;

  if (previous === null) {
    return <td className={`${baseClass} text-zinc-400`}>—</td>;
  }

  const change = current - previous;
  const pctChange = (change / previous) * 100;

  const isPositive = change > 0;
  const isNegative = change < 0;

  const colorClass = isPositive
    ? "text-red-600 dark:text-red-400"
    : isNegative
      ? "text-green-600 dark:text-green-400"
      : "text-zinc-500";

  const sign = isPositive ? "+" : isNegative ? "-" : "\u2007";

  return (
    <td className={`${baseClass} font-mono ${colorClass}`}>
      {sign}{Math.abs(pctChange).toFixed(1)}%
    </td>
  );
}
