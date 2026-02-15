'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clearProduceCache, readProduceCache, writeProduceCache } from '@/lib/produce-cache';
import { useDuckDB } from '@/lib/use-duckdb';

export interface ProduceRow {
  name: string;
  price: number;
  prev_day_price: number | null;
  prev_week_price: number | null;
  prev_month_price: number | null;
  prev_3_month_price: number | null;
  prev_6_month_price: number | null;
  prev_year_price: number | null;
  prev_2_year_price: number | null;
  prev_ytd_price: number | null;
  day_high: number | null;
  day_low: number | null;
  week_high: number | null;
  week_low: number | null;
  month_high: number | null;
  month_low: number | null;
  three_month_high: number | null;
  three_month_low: number | null;
  six_month_high: number | null;
  six_month_low: number | null;
  year_high: number | null;
  year_low: number | null;
  two_year_high: number | null;
  two_year_low: number | null;
  ytd_high: number | null;
  ytd_low: number | null;
  is_organic: boolean;
  is_ipm: boolean;
  is_waxed: boolean;
  is_local: boolean;
  is_hydroponic: boolean;
  is_new: boolean;
  first_seen_date: string | null;
  origin: string;
  unit: string;
  is_unavailable: boolean;
  unavailable_since_date: string | null;
}

export interface ProduceHistoryPoint {
  name: string;
  date: string;
  price: number;
}

export type ProduceHistoryMap = Map<string, ProduceHistoryPoint[]>;

export interface ProduceDateRange {
  start: string;
  end: string;
}

const LONG_RANGE_HISTORY_START = '2013-01-01';
const SWR_REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;
const SWR_PERIODS = new Set<ProduceSWRPeriod>([
  '3M',
  '6M',
  '1Y',
  '2Y',
  '5Y',
  '10Y',
  'SINCE_2013',
  'YTD',
]);

export type ProduceSWRPeriod = '3M' | '6M' | '1Y' | '2Y' | '5Y' | '10Y' | 'SINCE_2013' | 'YTD';

interface ProduceMetadata {
  years: {
    year: string;
    url: string;
    size: number;
    isCurrentYear: boolean;
  }[];
  derived?: {
    ytd: { url: string; size: number } | null;
    longRangeDownsampled: { url: string; size: number } | null;
  };
}

interface UseProduceDataResult {
  data: ProduceRow[];
  history: ProduceHistoryMap;
  dateRange: ProduceDateRange | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  revalidateForPeriod: (period: ProduceSWRPeriod) => void;
}

export function useProduceData(): UseProduceDataResult {
  const { isReady, isLoading: dbLoading, error: dbError, query, loadParquetBuffer } = useDuckDB();

  const [cachedState] = useState(() => readProduceCache());
  const hasCacheRef = useRef(!!cachedState);
  const [data, setData] = useState<ProduceRow[]>(cachedState?.data ?? []);
  const [history, setHistory] = useState<ProduceHistoryMap>(cachedState?.history ?? new Map());
  const [dateRange, setDateRange] = useState<ProduceDateRange | null>(
    cachedState?.dateRange ?? null,
  );
  const [loading, setLoading] = useState(!cachedState);
  const [refreshing, setRefreshing] = useState(!!cachedState);
  const [error, setError] = useState<string | null>(null);
  const didRetryAfterCacheClearRef = useRef(false);
  const isFetchingRef = useRef(false);
  const pendingPeriodRef = useRef<ProduceSWRPeriod | null>(null);
  const periodRefreshAtRef = useRef<Map<ProduceSWRPeriod, number>>(new Map());

  const loadData = useCallback(async () => {
    if (!isReady || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (!hasCacheRef.current) {
        setLoading(true);
      }
      setRefreshing(true);
      setError(null);

      const fetchAndBuildData = async () => {
        // Fetch metadata to get Parquet URLs
        const metaRes = await fetch('/api/produce/metadata');
        if (!metaRes.ok) throw new Error('Failed to fetch metadata');
        const meta: ProduceMetadata = await metaRes.json();

        if (meta.years.length === 0) {
          throw new Error('No produce data available');
        }

        const currentYearEntry = meta.years.find((entry) => entry.isCurrentYear);
        const currentYear = currentYearEntry
          ? Number.parseInt(currentYearEntry.year, 10)
          : Number.parseInt(meta.years[0].year, 10);
        const previousTwoYearEntries = meta.years.filter((entry) => {
          const yearNum = Number.parseInt(entry.year, 10);
          return yearNum === currentYear - 1 || yearNum === currentYear - 2;
        });

        const coreParquets = [
          meta.derived?.ytd?.url ? { tableName: 'produce_ytd', url: meta.derived.ytd.url } : null,
          ...previousTwoYearEntries.map((entry) => ({
            tableName: `produce_${entry.year}`,
            url: entry.url,
          })),
        ].filter(Boolean) as { tableName: string; url: string }[];

        const fallbackCoreParquets = meta.years
          .filter(
            (entry) =>
              entry.isCurrentYear ||
              previousTwoYearEntries.some((prev) => prev.year === entry.year),
          )
          .map((entry) => ({ tableName: `produce_${entry.year}`, url: entry.url }));

        const effectiveCoreParquets = coreParquets.length > 0 ? coreParquets : fallbackCoreParquets;
        if (effectiveCoreParquets.length === 0) {
          throw new Error('No core produce parquet files available');
        }
        const backgroundParquets = meta.derived?.longRangeDownsampled?.url
          ? [
              {
                tableName: 'produce_long_range_downsampled',
                url: meta.derived.longRangeDownsampled.url,
              },
            ]
          : [];

        const loadedTableNames: string[] = [];
        let latestHistoryMap = new Map<string, ProduceHistoryPoint[]>();
        let latestRange: ProduceDateRange | null = null;
        let hasDetailedRows = false;

        const refreshProduceUnion = async () => {
          if (loadedTableNames.length === 0) return;
          const unionQuery = loadedTableNames.map((t) => `SELECT * FROM ${t}`).join(' UNION ');
          await query(`CREATE OR REPLACE TABLE produce AS ${unionQuery}`);
        };

        const queryIncrementalRows = async () =>
          query<ProduceRow>(`
            WITH latest_date AS (
              SELECT MAX(date::DATE) as max_date FROM produce
            )
            SELECT
              p.name,
              p.price,
              NULL::DOUBLE as prev_day_price,
              NULL::DOUBLE as prev_week_price,
              NULL::DOUBLE as prev_month_price,
              NULL::DOUBLE as prev_3_month_price,
              NULL::DOUBLE as prev_6_month_price,
              NULL::DOUBLE as prev_year_price,
              NULL::DOUBLE as prev_2_year_price,
              NULL::DOUBLE as prev_ytd_price,
              NULL::DOUBLE as day_high,
              NULL::DOUBLE as day_low,
              NULL::DOUBLE as week_high,
              NULL::DOUBLE as week_low,
              NULL::DOUBLE as month_high,
              NULL::DOUBLE as month_low,
              NULL::DOUBLE as three_month_high,
              NULL::DOUBLE as three_month_low,
              NULL::DOUBLE as six_month_high,
              NULL::DOUBLE as six_month_low,
              NULL::DOUBLE as year_high,
              NULL::DOUBLE as year_low,
              NULL::DOUBLE as two_year_high,
              NULL::DOUBLE as two_year_low,
              NULL::DOUBLE as ytd_high,
              NULL::DOUBLE as ytd_low,
              p.is_organic,
              p.is_ipm,
              p.is_waxed,
              p.is_local,
              p.is_hydroponic,
              false as is_new,
              NULL::VARCHAR as first_seen_date,
              p.origin,
              p.unit,
              false as is_unavailable,
              NULL::VARCHAR as unavailable_since_date
            FROM produce p, latest_date
            WHERE p.date::DATE = max_date
            ORDER BY p.name
          `);

        const refreshIncrementalHistory = async () => {
          await refreshProduceUnion();
          const historyRows = await query<ProduceHistoryPoint>(`
            WITH latest_date AS (
              SELECT MAX(date::DATE) as max_date FROM produce
            )
            SELECT name, CAST(date::DATE AS VARCHAR) as date, price
            FROM produce, latest_date
            WHERE date::DATE BETWEEN DATE '${LONG_RANGE_HISTORY_START}' AND max_date
            ORDER BY name, date::DATE
          `);

          const historyMap = new Map<string, ProduceHistoryPoint[]>();
          let maxDate: string | null = null;
          for (const row of historyRows) {
            const existing = historyMap.get(row.name) ?? [];
            existing.push(row);
            historyMap.set(row.name, existing);
            if (!maxDate || row.date > maxDate) maxDate = row.date;
          }

          let range: ProduceDateRange | null = null;
          if (maxDate) {
            const minDate = historyRows[0]?.date ?? maxDate;
            range = { start: minDate, end: maxDate };
          }

          latestHistoryMap = historyMap;
          latestRange = range;
          setHistory(historyMap);
          setDateRange(range);

          const incrementalRows = await queryIncrementalRows();
          if (!hasDetailedRows && incrementalRows.length > 0) {
            setData(incrementalRows);
            setLoading(false);
          }
        };

        let ingestQueue = Promise.resolve();
        const enqueueIngest = (task: () => Promise<void>) => {
          const next = ingestQueue.then(task);
          ingestQueue = next.catch(() => {});
          return next;
        };

        const loadDescriptorGroup = async (descriptors: { tableName: string; url: string }[]) => {
          await Promise.all(
            descriptors.map(({ tableName, url }) =>
              (async () => {
                const response = await fetch(url);
                if (!response.ok) {
                  throw new Error(`Failed to fetch parquet ${tableName}: HTTP ${response.status}`);
                }
                const parquetBuffer = await response.arrayBuffer();
                await enqueueIngest(async () => {
                  await loadParquetBuffer(parquetBuffer, tableName);
                  if (!loadedTableNames.includes(tableName)) {
                    loadedTableNames.push(tableName);
                  }
                  await refreshIncrementalHistory();
                });
              })(),
            ),
          );
        };

        await loadDescriptorGroup(effectiveCoreParquets);

        // Query with price comparisons (using name as key to distinguish organic vs conventional)
        const results = await query<ProduceRow>(`
          WITH latest_date AS (
            SELECT MAX(date::DATE) as max_date FROM produce
          ),
          targets AS (
            SELECT
              (max_date - INTERVAL '7 days')::DATE as target_week,
              (max_date - INTERVAL '30 days')::DATE as target_month,
              (max_date - INTERVAL '90 days')::DATE as target_3_month,
              (max_date - INTERVAL '180 days')::DATE as target_6_month,
              (max_date - INTERVAL '365 days')::DATE as target_year,
              (max_date - INTERVAL '730 days')::DATE as target_2_year,
              date_trunc('year', max_date)::DATE as target_ytd
            FROM latest_date
          ),
          current_prices AS (
            SELECT name, name, price, is_organic, is_ipm, is_waxed, is_local, is_hydroponic, origin, unit
            FROM produce, latest_date
            WHERE date::DATE = max_date
          ),
          last_seen AS (
            SELECT name, MAX(date::DATE) as last_seen_date
            FROM produce
            GROUP BY name
          ),
          unavailable_recent AS (
            SELECT l.name, l.last_seen_date
            FROM last_seen l, latest_date
            WHERE l.last_seen_date < max_date
              AND l.last_seen_date >= max_date - INTERVAL '30 days'
          ),
          last_seen_rows AS (
            SELECT
              p.name,
              p.name,
              p.price,
              p.is_organic,
              p.is_ipm,
              p.is_waxed,
              p.is_local,
              p.is_hydroponic,
              p.origin,
              p.unit,
              u.last_seen_date
            FROM produce p
            JOIN unavailable_recent u
              ON p.name = u.name AND p.date::DATE = u.last_seen_date
          ),
          prev_day AS (
            SELECT name, price as prev_day_price
            FROM produce, latest_date
            WHERE date::DATE = (
              SELECT MAX(date::DATE) FROM produce WHERE date::DATE < max_date
            )
          ),
          prev_week AS (
            SELECT name, price as prev_week_price
            FROM (
              SELECT
                p.name,
                p.price,
                p.date::DATE as date,
                ROW_NUMBER() OVER (
                  PARTITION BY p.name
                  ORDER BY ABS(p.date::DATE - t.target_week), p.date::DATE ASC
                ) as rn
              FROM produce p, targets t
            )
            WHERE rn = 1
          ),
          prev_month AS (
            SELECT name, price as prev_month_price
            FROM (
              SELECT
                p.name,
                p.price,
                p.date::DATE as date,
                ROW_NUMBER() OVER (
                  PARTITION BY p.name
                  ORDER BY ABS(p.date::DATE - t.target_month), p.date::DATE ASC
                ) as rn
              FROM produce p, targets t
            )
            WHERE rn = 1
          ),
          prev_3_month AS (
            SELECT name, price as prev_3_month_price
            FROM (
              SELECT
                p.name,
                p.price,
                p.date::DATE as date,
                ROW_NUMBER() OVER (
                  PARTITION BY p.name
                  ORDER BY ABS(p.date::DATE - t.target_3_month), p.date::DATE ASC
                ) as rn
              FROM produce p, targets t
            )
            WHERE rn = 1
          ),
          prev_6_month AS (
            SELECT name, price as prev_6_month_price
            FROM (
              SELECT
                p.name,
                p.price,
                p.date::DATE as date,
                ROW_NUMBER() OVER (
                  PARTITION BY p.name
                  ORDER BY ABS(p.date::DATE - t.target_6_month), p.date::DATE ASC
                ) as rn
              FROM produce p, targets t
            )
            WHERE rn = 1
          ),
          prev_year AS (
            SELECT name, price as prev_year_price
            FROM (
              SELECT
                p.name,
                p.price,
                p.date::DATE as date,
                ROW_NUMBER() OVER (
                  PARTITION BY p.name
                  ORDER BY ABS(p.date::DATE - t.target_year), p.date::DATE ASC
                ) as rn
              FROM produce p, targets t
            )
            WHERE rn = 1
          ),
          prev_2_year AS (
            SELECT name, price as prev_2_year_price
            FROM (
              SELECT
                p.name,
                p.price,
                p.date::DATE as date,
                ROW_NUMBER() OVER (
                  PARTITION BY p.name
                  ORDER BY ABS(p.date::DATE - t.target_2_year), p.date::DATE ASC
                ) as rn
              FROM produce p, targets t
            )
            WHERE rn = 1
          ),
          prev_ytd AS (
            SELECT name, price as prev_ytd_price
            FROM (
              SELECT
                p.name,
                p.price,
                p.date::DATE as date,
                ROW_NUMBER() OVER (
                  PARTITION BY p.name
                  ORDER BY
                    CASE WHEN p.date::DATE >= t.target_ytd THEN 0 ELSE 1 END,
                    CASE
                      WHEN p.date::DATE >= t.target_ytd
                        THEN p.date::DATE - t.target_ytd
                      ELSE t.target_ytd - p.date::DATE
                    END,
                    p.date::DATE ASC
                ) as rn
              FROM produce p, targets t
            )
            WHERE rn = 1
          ),
          prev_month_items AS (
            SELECT DISTINCT name
            FROM produce, latest_date
            WHERE date_trunc('month', date::DATE) = date_trunc('month', max_date) - INTERVAL '1 month'
          ),
          first_appearance AS (
            SELECT name, MIN(date::DATE) as first_seen_date
            FROM produce, latest_date
            WHERE date_trunc('month', date::DATE) = date_trunc('month', max_date)
            GROUP BY name
          ),
          current_with_new AS (
            SELECT
              c.name,
              c.name,
              c.price,
              c.is_organic,
              c.is_ipm,
              c.is_waxed,
              c.is_local,
              c.is_hydroponic,
              CASE WHEN pm.name IS NULL THEN true ELSE false END as is_new,
              CASE WHEN pm.name IS NULL THEN fa.first_seen_date::VARCHAR ELSE NULL END as first_seen_date,
              c.origin,
              c.unit,
              false as is_unavailable,
              NULL::VARCHAR as unavailable_since_date
            FROM current_prices c
            LEFT JOIN prev_month_items pm ON c.name = pm.name
            LEFT JOIN first_appearance fa ON c.name = fa.name
          ),
          unavailable_rows AS (
            SELECT
              r.name,
              r.name,
              r.price,
              r.is_organic,
              r.is_ipm,
              r.is_waxed,
              r.is_local,
              r.is_hydroponic,
              CASE WHEN pm.name IS NULL THEN true ELSE false END as is_new,
              CASE WHEN pm.name IS NULL THEN fa.first_seen_date::VARCHAR ELSE NULL END as first_seen_date,
              r.origin,
              r.unit,
              true as is_unavailable,
              (r.last_seen_date + INTERVAL '1 day')::DATE::VARCHAR as unavailable_since_date
            FROM last_seen_rows r
            LEFT JOIN prev_month_items pm ON r.name = pm.name
            LEFT JOIN first_appearance fa ON r.name = fa.name
          ),
          base_rows AS (
            SELECT * FROM current_with_new
            UNION ALL
            SELECT * FROM unavailable_rows
          ),
          prev_day_date AS (
            SELECT MAX(date::DATE) as prev_date FROM produce, latest_date WHERE date::DATE < max_date
          ),
          day_high_low AS (
            SELECT name, MAX(price) as day_high, MIN(price) as day_low
            FROM produce, prev_day_date, latest_date
            WHERE date::DATE >= prev_date AND date::DATE <= max_date
            GROUP BY name
          ),
          week_high_low AS (
            SELECT name, MAX(price) as week_high, MIN(price) as week_low
            FROM produce, latest_date
            WHERE date::DATE >= max_date - INTERVAL '7 days'
            GROUP BY name
          ),
          month_high_low AS (
            SELECT name, MAX(price) as month_high, MIN(price) as month_low
            FROM produce, latest_date
            WHERE date::DATE >= max_date - INTERVAL '30 days'
            GROUP BY name
          ),
          three_month_high_low AS (
            SELECT name, MAX(price) as three_month_high, MIN(price) as three_month_low
            FROM produce, latest_date
            WHERE date::DATE >= max_date - INTERVAL '90 days'
            GROUP BY name
          ),
          six_month_high_low AS (
            SELECT name, MAX(price) as six_month_high, MIN(price) as six_month_low
            FROM produce, latest_date
            WHERE date::DATE >= max_date - INTERVAL '180 days'
            GROUP BY name
          ),
          year_high_low AS (
            SELECT name, MAX(price) as year_high, MIN(price) as year_low
            FROM produce, latest_date
            WHERE date::DATE >= max_date - INTERVAL '365 days'
            GROUP BY name
          ),
          two_year_high_low AS (
            SELECT name, MAX(price) as two_year_high, MIN(price) as two_year_low
            FROM produce, latest_date
            WHERE date::DATE >= max_date - INTERVAL '730 days'
            GROUP BY name
          ),
          ytd_high_low AS (
            SELECT name, MAX(price) as ytd_high, MIN(price) as ytd_low
            FROM produce, latest_date
            WHERE date::DATE >= date_trunc('year', max_date)
            GROUP BY name
          )
          SELECT
            b.name,
            b.name,
            b.price,
            b.is_organic,
            b.is_ipm,
            b.is_waxed,
            b.is_local,
            b.is_hydroponic,
            b.is_new,
            b.first_seen_date,
            b.origin,
            b.unit,
            d.prev_day_price,
            w.prev_week_price,
            m.prev_month_price,
            m3.prev_3_month_price,
            m6.prev_6_month_price,
            y.prev_year_price,
            y2.prev_2_year_price,
            ytd.prev_ytd_price,
            dhl.day_high,
            dhl.day_low,
            whl.week_high,
            whl.week_low,
            mhl.month_high,
            mhl.month_low,
            m3hl.three_month_high,
            m3hl.three_month_low,
            m6hl.six_month_high,
            m6hl.six_month_low,
            yhl.year_high,
            yhl.year_low,
            y2hl.two_year_high,
            y2hl.two_year_low,
            ytdhl.ytd_high,
            ytdhl.ytd_low,
            b.is_unavailable,
            b.unavailable_since_date
          FROM base_rows b
          LEFT JOIN prev_day d ON b.name = d.name
          LEFT JOIN prev_week w ON b.name = w.name
          LEFT JOIN prev_month m ON b.name = m.name
          LEFT JOIN prev_3_month m3 ON b.name = m3.name
          LEFT JOIN prev_6_month m6 ON b.name = m6.name
          LEFT JOIN prev_year y ON b.name = y.name
          LEFT JOIN prev_2_year y2 ON b.name = y2.name
          LEFT JOIN prev_ytd ytd ON b.name = ytd.name
          LEFT JOIN day_high_low dhl ON b.name = dhl.name
          LEFT JOIN week_high_low whl ON b.name = whl.name
          LEFT JOIN month_high_low mhl ON b.name = mhl.name
          LEFT JOIN three_month_high_low m3hl ON b.name = m3hl.name
          LEFT JOIN six_month_high_low m6hl ON b.name = m6hl.name
          LEFT JOIN year_high_low yhl ON b.name = yhl.name
          LEFT JOIN two_year_high_low y2hl ON b.name = y2hl.name
          LEFT JOIN ytd_high_low ytdhl ON b.name = ytdhl.name
          ORDER BY b.name
        `);

        hasDetailedRows = true;
        setData(results);

        if (backgroundParquets.length > 0) {
          try {
            await loadDescriptorGroup(backgroundParquets);
          } catch (backgroundError) {
            console.error('Background parquet load failed:', backgroundError);
          }
        }

        writeProduceCache(results, latestHistoryMap, latestRange);
      };

      try {
        await fetchAndBuildData();
        didRetryAfterCacheClearRef.current = false;
      } catch (initialError) {
        if (!didRetryAfterCacheClearRef.current) {
          didRetryAfterCacheClearRef.current = true;
          clearProduceCache();
          hasCacheRef.current = false;
          await fetchAndBuildData();
          didRetryAfterCacheClearRef.current = false;
        } else {
          throw initialError;
        }
      }
    } catch (err) {
      didRetryAfterCacheClearRef.current = false;
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);

      const pendingPeriod = pendingPeriodRef.current;
      pendingPeriodRef.current = null;
      if (pendingPeriod) {
        const now = Date.now();
        periodRefreshAtRef.current.set(pendingPeriod, now);
      }
    }
  }, [isReady, query, loadParquetBuffer]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const revalidateForPeriod = useCallback(
    (period: ProduceSWRPeriod) => {
      if (!SWR_PERIODS.has(period) || !isReady) return;
      const now = Date.now();
      const lastRefreshAt = periodRefreshAtRef.current.get(period) ?? 0;
      if (now - lastRefreshAt < SWR_REVALIDATE_INTERVAL_MS) return;
      if (isFetchingRef.current) return;

      pendingPeriodRef.current = period;
      loadData();
    },
    [isReady, loadData],
  );

  const hasCachedData = data.length > 0 && !loading;
  const isLoading = hasCachedData ? false : dbLoading || loading;
  const isRefreshing = hasCachedData && (dbLoading || refreshing);
  const combinedError = dbError?.message || error;

  return {
    data,
    history,
    dateRange,
    isLoading,
    isRefreshing,
    error: combinedError,
    revalidateForPeriod,
  };
}
