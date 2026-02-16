import type { DuckDBClient } from '@/lib/duckdb-client';
import type { ProduceDateRange, ProduceHistoryPoint, ProduceRow } from '@/lib/produce-types';

const LONG_RANGE_HISTORY_START = '2013-01-01';

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

export async function loadProduceData(client: DuckDBClient): Promise<{
  data: ProduceRow[];
  history: Map<string, ProduceHistoryPoint[]>;
  dateRange: ProduceDateRange | null;
}> {
  const metaRes = await fetch('/api/produce/metadata');
  if (!metaRes.ok) {
    throw new Error('Failed to fetch metadata');
  }
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
        entry.isCurrentYear || previousTwoYearEntries.some((prev) => prev.year === entry.year),
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

  const descriptors = [...effectiveCoreParquets, ...backgroundParquets];
  await Promise.all(
    descriptors.map(async ({ tableName, url }) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch parquet ${tableName}: HTTP ${response.status}`);
      }
      const parquetBuffer = await response.arrayBuffer();
      await client.loadParquetBuffer(parquetBuffer, tableName);
    }),
  );

  const unionQuery = descriptors.map((item) => `SELECT * FROM ${item.tableName}`).join(' UNION ');
  await client.query(`CREATE OR REPLACE TABLE produce AS ${unionQuery}`);

  const historyRows = await client.query<ProduceHistoryPoint>(`
    WITH latest_date AS (
      SELECT MAX(date::DATE) as max_date FROM produce
    )
    SELECT name, CAST(date::DATE AS VARCHAR) as date, price
    FROM produce, latest_date
    WHERE date::DATE BETWEEN DATE '${LONG_RANGE_HISTORY_START}' AND max_date
    ORDER BY name, date::DATE
  `);

  const history = new Map<string, ProduceHistoryPoint[]>();
  let maxDate: string | null = null;
  for (const row of historyRows) {
    const existing = history.get(row.name) ?? [];
    existing.push(row);
    history.set(row.name, existing);
    if (!maxDate || row.date > maxDate) maxDate = row.date;
  }

  const dateRange: ProduceDateRange | null = maxDate
    ? {
        start: historyRows[0]?.date ?? maxDate,
        end: maxDate,
      }
    : null;

  const data = await client.query<ProduceRow>(`
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

  return { data, history, dateRange };
}
