import { ParquetReader } from '@dsnp/parquetjs';

import { list } from '@/lib/s3-storage';
import type { ProduceEvent } from '@/lib/types';

const CACHE_DURATION = 5 * 60 * 1000;

let cachedEvents: ProduceEvent[] | null = null;
let cacheTime = 0;

function parseIsoDate(value: unknown): string | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return null;
}

function parseName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isoToUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

function addDaysIso(isoDate: string, days: number): string {
  const date = isoToUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function loadParquetNameDateRows(
  url: string,
): Promise<Array<{ name: string; date: string }>> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch produce parquet: HTTP ${response.status}`);
  }

  const parquetBuffer = Buffer.from(await response.arrayBuffer());
  const reader = await ParquetReader.openBuffer(parquetBuffer);
  const cursor = reader.getCursor();
  const rows: Array<{ name: string; date: string }> = [];

  try {
    while (true) {
      const row = (await cursor.next()) as Record<string, unknown> | null;
      if (!row) {
        break;
      }

      const name = parseName(row['name']);
      const date = parseIsoDate(row['date']);
      if (!name || !date) {
        continue;
      }
      rows.push({ name, date });
    }
  } finally {
    await reader.close();
  }

  return rows;
}

function pushGroupedName(map: Map<string, Set<string>>, date: string, name: string): void {
  const existing = map.get(date);
  if (existing) {
    existing.add(name);
    return;
  }
  map.set(date, new Set([name]));
}

export async function GET(): Promise<Response> {
  try {
    const now = Date.now();
    if (cachedEvents && now - cacheTime < CACHE_DURATION) {
      return Response.json({
        events: cachedEvents,
        total: cachedEvents.length,
        lastUpdated: new Date(cacheTime).toISOString(),
      });
    }

    const { blobs } = await list({
      prefix: 'produce-data-yearly/',
    });

    const latestByYear = new Map<string, (typeof blobs)[number]>();
    for (const blob of blobs) {
      const match = blob.pathname.match(/^produce-data-yearly\/(\d{4})-[a-f0-9]{7}\.parquet$/);
      if (!match) {
        continue;
      }
      const year = match[1];
      if (!year) {
        continue;
      }
      const previous = latestByYear.get(year);
      if (
        !previous ||
        new Date(blob.uploadedAt).getTime() > new Date(previous.uploadedAt).getTime()
      ) {
        latestByYear.set(year, blob);
      }
    }

    const availableYears = Array.from(latestByYear.keys()).sort((a, b): number =>
      b.localeCompare(a),
    );
    if (availableYears.length === 0) {
      cachedEvents = [];
      cacheTime = now;
      return Response.json({
        events: [],
        total: 0,
        lastUpdated: new Date(cacheTime).toISOString(),
      });
    }

    const currentYear = new Date()
      .toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      .slice(0, 4);
    const fallbackYear = availableYears[0];
    if (!fallbackYear) {
      cachedEvents = [];
      cacheTime = now;
      return Response.json({
        events: [],
        total: 0,
        lastUpdated: new Date(cacheTime).toISOString(),
      });
    }
    const referenceYear = latestByYear.has(currentYear) ? currentYear : fallbackYear;

    const selectedYears = [referenceYear];
    const previousYear = String(Number.parseInt(referenceYear, 10) - 1);
    if (latestByYear.has(previousYear)) {
      selectedYears.push(previousYear);
    }

    const selectedBlobs = selectedYears
      .map((year) => latestByYear.get(year))
      .filter((blob): blob is (typeof blobs)[number] => Boolean(blob));

    const rowsByBlob = await Promise.all(
      selectedBlobs.map(
        (blob): Promise<{ name: string; date: string }[]> => loadParquetNameDateRows(blob.url),
      ),
    );
    const rows = rowsByBlob.flat();

    if (rows.length === 0) {
      cachedEvents = [];
      cacheTime = now;
      return Response.json({
        events: [],
        total: 0,
        lastUpdated: new Date(cacheTime).toISOString(),
      });
    }

    const firstRow = rows[0];
    if (!firstRow) {
      cachedEvents = [];
      cacheTime = now;
      return Response.json({
        events: [],
        total: 0,
        lastUpdated: new Date(cacheTime).toISOString(),
      });
    }
    const maxDate = rows.reduce(
      (latest, row): string => (row.date > latest ? row.date : latest),
      firstRow.date,
    );
    const arrivalCutoff = addDaysIso(maxDate, -30);
    const unavailableCutoff = addDaysIso(maxDate, -30);

    const lastSeenByName = new Map<string, string>();
    const firstSeenByName = new Map<string, string>();

    for (const row of rows) {
      const { name, date } = row;
      const previousLastSeen = lastSeenByName.get(name);
      if (!previousLastSeen || date > previousLastSeen) {
        lastSeenByName.set(name, date);
      }
      const previousFirstSeen = firstSeenByName.get(name);
      if (!previousFirstSeen || date < previousFirstSeen) {
        firstSeenByName.set(name, date);
      }
    }

    const arrivalsByDate = new Map<string, Set<string>>();
    const outOfStockByDate = new Map<string, Set<string>>();

    for (const [name, firstSeen] of firstSeenByName) {
      if (firstSeen < arrivalCutoff) {
        continue;
      }
      if (!firstSeen) {
        continue;
      }
      pushGroupedName(arrivalsByDate, firstSeen, name);
    }

    for (const [name, lastSeen] of lastSeenByName) {
      if (lastSeen >= maxDate || lastSeen < unavailableCutoff) {
        continue;
      }
      const unavailableSince = addDaysIso(lastSeen, 1);
      pushGroupedName(outOfStockByDate, unavailableSince, name);
    }

    const allDates = new Set([...arrivalsByDate.keys(), ...outOfStockByDate.keys()]);

    const events: ProduceEvent[] = [];
    for (const date of allDates) {
      const newArrivals = Array.from(arrivalsByDate.get(date) ?? [])
        .sort((a, b): number => a.localeCompare(b))
        .map((name): { name: string } => ({ name }));
      const outOfStock = Array.from(outOfStockByDate.get(date) ?? [])
        .sort((a, b): number => a.localeCompare(b))
        .map((name): { name: string } => ({ name }));
      if (newArrivals.length === 0 && outOfStock.length === 0) {
        continue;
      }

      events.push({
        id: date,
        date,
        newArrivals,
        outOfStock,
      });
    }

    events.sort((a, b): number => b.date.localeCompare(a.date));
    cachedEvents = events;
    cacheTime = now;

    return Response.json({
      events,
      total: events.length,
      lastUpdated: new Date(cacheTime).toISOString(),
    });
  } catch (error) {
    console.error('Produce updates API error:', error);
    return Response.json({ error: 'Failed to load produce updates' }, { status: 500 });
  }
}
