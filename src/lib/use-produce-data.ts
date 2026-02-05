'use client';

import { useEffect, useState } from 'react';
import { useDuckDB } from '@/lib/use-duckdb';

export interface ProduceRow {
  name: string;
  price: number;
  prev_day_price: number | null;
  prev_week_price: number | null;
  prev_month_price: number | null;
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

interface ProduceMetadata {
  months: {
    month: string;
    url: string;
    size: number;
    isCurrentMonth: boolean;
  }[];
}

interface UseProduceDataResult {
  data: ProduceRow[];
  history: ProduceHistoryMap;
  isLoading: boolean;
  error: string | null;
}

export function useProduceData(): UseProduceDataResult {
  const { isReady, isLoading: dbLoading, error: dbError, query, loadParquet } = useDuckDB();
  const [data, setData] = useState<ProduceRow[]>([]);
  const [history, setHistory] = useState<ProduceHistoryMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch metadata to get Parquet URLs
        const metaRes = await fetch('/api/produce/metadata');
        if (!metaRes.ok) throw new Error('Failed to fetch metadata');
        const meta: ProduceMetadata = await metaRes.json();

        if (meta.months.length === 0) {
          setError('No produce data available');
          return;
        }

        // Load all available months
        for (const { url, month } of meta.months) {
          await loadParquet(url, `produce_${month.replace('-', '_')}`);
        }

        // Create unified view
        const tableNames = meta.months.map((m) => `produce_${m.month.replace('-', '_')}`);
        const unionQuery = tableNames.map((t) => `SELECT * FROM ${t}`).join(' UNION ALL ');
        await query(`CREATE OR REPLACE TABLE produce AS ${unionQuery}`);

        // Query with price comparisons (using name as key to distinguish organic vs conventional)
        const results = await query<ProduceRow>(`
          WITH latest_date AS (
            SELECT MAX(date::DATE) as max_date FROM produce
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
            SELECT name, AVG(price) as prev_week_price
            FROM produce, latest_date
            WHERE date::DATE BETWEEN max_date - INTERVAL '7 days' AND max_date - INTERVAL '1 day'
            GROUP BY name
          ),
          prev_month AS (
            SELECT name, AVG(price) as prev_month_price
            FROM produce, latest_date
            WHERE date::DATE BETWEEN max_date - INTERVAL '30 days' AND max_date - INTERVAL '1 day'
            GROUP BY name
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
              false as is_new,
              NULL::VARCHAR as first_seen_date,
              r.origin,
              r.unit,
              true as is_unavailable,
              r.last_seen_date::VARCHAR as unavailable_since_date
            FROM last_seen_rows r
          ),
          base_rows AS (
            SELECT * FROM current_with_new
            UNION ALL
            SELECT * FROM unavailable_rows
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
            b.is_unavailable,
            b.unavailable_since_date
          FROM base_rows b
          LEFT JOIN prev_day d ON b.name = d.name
          LEFT JOIN prev_week w ON b.name = w.name
          LEFT JOIN prev_month m ON b.name = m.name
          ORDER BY b.name
        `);

        setData(results);

        const historyRows = await query<ProduceHistoryPoint>(`
          WITH latest_date AS (
            SELECT MAX(date::DATE) as max_date FROM produce
          )
          SELECT name, date::DATE as date, price
          FROM produce, latest_date
          WHERE date::DATE BETWEEN max_date - INTERVAL '30 days' AND max_date
          ORDER BY name, date::DATE
        `);

        const historyMap = new Map<string, ProduceHistoryPoint[]>();
        for (const row of historyRows) {
          const existing = historyMap.get(row.name) ?? [];
          existing.push(row);
          historyMap.set(row.name, existing);
        }
        setHistory(historyMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isReady, query, loadParquet]);

  const isLoading = dbLoading || loading;
  const combinedError = dbError?.message || error;

  return { data, history, isLoading, error: combinedError };
}
