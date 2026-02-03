'use client';

import { useEffect, useState } from 'react';
import { useDuckDB } from '@/lib/use-duckdb';

export interface ProduceRow {
  raw_name: string;
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

interface UseProduceDataResult {
  data: ProduceRow[];
  isLoading: boolean;
  error: string | null;
}

export function useProduceData(): UseProduceDataResult {
  const { isReady, isLoading: dbLoading, error: dbError, query, loadParquet } = useDuckDB();
  const [data, setData] = useState<ProduceRow[]>([]);
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

        // Query with price comparisons (using raw_name as key to distinguish organic vs conventional)
        const results = await query<ProduceRow>(`
          WITH latest_date AS (
            SELECT MAX(date::DATE) as max_date FROM produce
          ),
          current_prices AS (
            SELECT raw_name, name, price, is_organic, is_ipm, is_waxed, is_local, is_hydroponic, origin, unit
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
          ),
          prev_month_items AS (
            SELECT DISTINCT raw_name
            FROM produce, latest_date
            WHERE date_trunc('month', date::DATE) = date_trunc('month', max_date) - INTERVAL '1 month'
          )
          SELECT
            c.raw_name,
            c.name,
            c.price,
            c.is_organic,
            c.is_ipm,
            c.is_waxed,
            c.is_local,
            c.is_hydroponic,
            CASE WHEN pm.raw_name IS NULL THEN true ELSE false END as is_new,
            c.origin,
            c.unit,
            d.prev_day_price,
            w.prev_week_price,
            m.prev_month_price
          FROM current_prices c
          LEFT JOIN prev_day d ON c.raw_name = d.raw_name
          LEFT JOIN prev_week w ON c.raw_name = w.raw_name
          LEFT JOIN prev_month m ON c.raw_name = m.raw_name
          LEFT JOIN prev_month_items pm ON c.raw_name = pm.raw_name
          ORDER BY c.name
        `);

        setData(results);
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

  return { data, isLoading, error: combinedError };
}
