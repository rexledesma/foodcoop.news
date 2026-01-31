"use client";

import { useEffect, useState, useMemo } from "react";
import { useDuckDB } from "@/lib/use-duckdb";

interface ProduceRow {
  raw_name: string;
  name: string;
  price: number;
  prev_day_price: number | null;
  prev_week_price: number | null;
  prev_month_price: number | null;
  is_organic: boolean;
  is_local: boolean;
  origin: string;
  unit: string;
}

interface ProduceMetadata {
  months: {
    month: string;
    url: string;
    size: number;
    isCurrentMonth: boolean;
  }[];
}

type SortField = "name" | "price" | "day_change" | "day_change_pct" | "week_change" | "month_change";
type SortDirection = "asc" | "desc";

export function ProduceAnalytics() {
  const { isReady, isLoading: dbLoading, error: dbError, query, loadParquet } = useDuckDB();
  const [data, setData] = useState<ProduceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  useEffect(() => {
    if (!isReady) return;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch metadata to get Parquet URLs
        const metaRes = await fetch("/api/produce/metadata");
        if (!metaRes.ok) throw new Error("Failed to fetch metadata");
        const meta: ProduceMetadata = await metaRes.json();

        if (meta.months.length === 0) {
          setError("No produce data available");
          return;
        }

        // Load all available months
        for (const { url, month } of meta.months) {
          await loadParquet(url, `produce_${month.replace("-", "_")}`);
        }

        // Create unified view
        const tableNames = meta.months.map((m) => `produce_${m.month.replace("-", "_")}`);
        const unionQuery = tableNames.map((t) => `SELECT * FROM ${t}`).join(" UNION ALL ");
        await query(`CREATE OR REPLACE TABLE produce AS ${unionQuery}`);

        // Query with price comparisons (using raw_name as key to distinguish organic vs conventional)
        const results = await query<ProduceRow>(`
          WITH latest_date AS (
            SELECT MAX(date::DATE) as max_date FROM produce
          ),
          current_prices AS (
            SELECT raw_name, name, price, is_organic, is_local, origin, unit
            FROM produce, latest_date
            WHERE date::DATE = max_date
          ),
          prev_day AS (
            SELECT raw_name, price as prev_day_price
            FROM produce, latest_date
            WHERE date::DATE = (
              SELECT MAX(date::DATE) FROM produce WHERE date::DATE < max_date
            )
          ),
          prev_week AS (
            SELECT raw_name, AVG(price) as prev_week_price
            FROM produce, latest_date
            WHERE date::DATE BETWEEN max_date - INTERVAL '7 days' AND max_date - INTERVAL '1 day'
            GROUP BY raw_name
          ),
          prev_month AS (
            SELECT raw_name, AVG(price) as prev_month_price
            FROM produce, latest_date
            WHERE date::DATE BETWEEN max_date - INTERVAL '30 days' AND max_date - INTERVAL '1 day'
            GROUP BY raw_name
          )
          SELECT
            c.raw_name,
            c.name,
            c.price,
            c.is_organic,
            c.is_local,
            c.origin,
            c.unit,
            d.prev_day_price,
            w.prev_week_price,
            m.prev_month_price
          FROM current_prices c
          LEFT JOIN prev_day d ON c.raw_name = d.raw_name
          LEFT JOIN prev_week w ON c.raw_name = w.raw_name
          LEFT JOIN prev_month m ON c.raw_name = m.raw_name
          ORDER BY c.name
        `);

        setData(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isReady, query, loadParquet]);

  const filteredAndSorted = useMemo(() => {
    let result = data;

    // Filter by search
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (row) =>
          row.name.toLowerCase().includes(lower) ||
          row.origin.toLowerCase().includes(lower)
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
          aVal = a.prev_day_price ? (a.price - a.prev_day_price) : 0;
          bVal = b.prev_day_price ? (b.price - b.prev_day_price) : 0;
          break;
        case "day_change_pct":
          aVal = a.prev_day_price ? ((a.price - a.prev_day_price) / a.prev_day_price) : 0;
          bVal = b.prev_day_price ? ((b.price - b.prev_day_price) / b.prev_day_price) : 0;
          break;
        case "week_change":
          aVal = a.prev_week_price ? ((a.price - a.prev_week_price) / a.prev_week_price) : 0;
          bVal = b.prev_week_price ? ((b.price - b.prev_week_price) / b.prev_week_price) : 0;
          break;
        case "month_change":
          aVal = a.prev_month_price ? ((a.price - a.prev_month_price) / a.prev_month_price) : 0;
          bVal = b.prev_month_price ? ((b.price - b.prev_month_price) / b.prev_month_price) : 0;
          break;
        default:
          return 0;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return result;
  }, [data, search, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  if (dbLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-zinc-500 dark:text-zinc-400">Loading produce data...</div>
      </div>
    );
  }

  if (dbError || error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-500">{dbError?.message || error}</div>
      </div>
    );
  }

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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <SortHeader field="name" current={sortField} direction={sortDirection} onClick={handleSort}>
                Name
              </SortHeader>
              <SortHeader field="price" current={sortField} direction={sortDirection} onClick={handleSort} className="text-right">
                Price
              </SortHeader>
              <SortHeader field="day_change" current={sortField} direction={sortDirection} onClick={handleSort} className="text-right">
                Change
              </SortHeader>
              <SortHeader field="day_change_pct" current={sortField} direction={sortDirection} onClick={handleSort} className="text-right whitespace-nowrap">
                Change %
              </SortHeader>
              <SortHeader field="week_change" current={sortField} direction={sortDirection} onClick={handleSort} className="text-right">
                Week
              </SortHeader>
              <SortHeader field="month_change" current={sortField} direction={sortDirection} onClick={handleSort} className="text-right">
                Month
              </SortHeader>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((row) => (
              <tr key={row.raw_name} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="py-3 pr-4">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">{row.name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {row.is_organic && <span className="text-green-600 dark:text-green-400">Organic</span>}
                    {row.is_organic && row.is_local && " · "}
                    {row.is_local && <span className="text-blue-600 dark:text-blue-400">Local</span>}
                  </div>
                </td>
                <td className="py-3 px-2 text-right font-mono text-zinc-900 dark:text-zinc-100">
                  ${row.price.toFixed(2)}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-1">/{row.unit}</span>
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
      className={`py-3 px-2 font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200 select-none ${className}`}
      onClick={() => onClick(field)}
    >
      {children}
      {isActive && (
        <span className="ml-1">{direction === "asc" ? "↑" : "↓"}</span>
      )}
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
  if (previous === null) {
    return <td className="py-3 px-2 text-right text-zinc-400">—</td>;
  }

  const change = current - previous;
  const isPositive = change > 0;
  const isNegative = change < 0;

  const colorClass = isPositive
    ? "text-red-600 dark:text-red-400"
    : isNegative
      ? "text-green-600 dark:text-green-400"
      : "text-zinc-500";

  const sign = isPositive ? "+$" : isNegative ? "-$" : "$";

  return (
    <td className={`py-3 px-2 text-right font-mono ${colorClass}`}>
      {sign}{Math.abs(change).toFixed(2)}
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
  if (previous === null) {
    return <td className="py-3 px-2 text-right text-zinc-400">—</td>;
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

  return (
    <td className={`py-3 px-2 text-right font-mono ${colorClass}`}>
      {isPositive && "+"}
      {pctChange.toFixed(1)}%
    </td>
  );
}
