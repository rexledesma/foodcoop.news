import { del, list, put } from '@vercel/blob';
import { ParquetReader } from '@dsnp/parquetjs';
import { randomBytes } from 'crypto';
import { parseProduceHtml } from '@/lib/produce-parser';
import { generateParquetBuffer } from '@/lib/parquet-generator';
import type { ProduceItem } from '@/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const DERIVED_PREFIX = 'produce-data-derived/';
const SINCE_2013_START = '2013-01-01';

export async function regenerateMonthParquet(month: string): Promise<{
  url: string;
  itemCount: number;
  daysCount: number;
}> {
  const allItems: ProduceItem[] = [];
  let daysCount = 0;

  // List all HTML files for this month
  const { blobs } = await list({
    prefix: `produce/${month}`,
    token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  });

  for (const blob of blobs) {
    const match = blob.pathname.match(/produce\/(\d{4}-\d{2}-\d{2})\.html$/);
    if (!match) continue;

    const date = match[1];
    daysCount++;

    const response = await fetch(blob.url);
    if (!response.ok) continue;

    const html = await response.text();
    const { items } = parseProduceHtml(html, date);
    allItems.push(...items);
  }

  // Generate and upload Parquet
  const buffer = await generateParquetBuffer(allItems);
  const version = randomBytes(4).toString('hex').slice(0, 7);
  const parquetBlob = await put(`produce-data/${month}-${version}.parquet`, buffer, {
    contentType: 'application/octet-stream',
    access: 'public',
    token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  });

  // Keep exactly one parquet per month to avoid stale canonical URLs.
  const { blobs: monthParquetBlobs } = await list({
    prefix: `produce-data/${month}`,
    token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  });

  const monthParquetPathsToDelete = monthParquetBlobs
    .map((blob) => blob.pathname)
    .filter(
      (pathname) =>
        pathname !== parquetBlob.pathname &&
        new RegExp(`^produce-data/${month}(?:-[^.]+)?\\.parquet$`).test(pathname),
    );

  if (monthParquetPathsToDelete.length > 0) {
    await del(monthParquetPathsToDelete, {
      token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
    });
  }

  return {
    url: parquetBlob.url,
    itemCount: allItems.length,
    daysCount,
  };
}

function parseParquetBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return false;
}

function parseParquetNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function parseParquetString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return `${value}`;
  }
  return '';
}

function parseParquetUnit(value: unknown): ProduceItem['unit'] {
  if (value === 'pound' || value === 'each' || value === 'bunch') return value;
  return 'each';
}

function toProduceItemFromParquetRow(row: Record<string, unknown>): ProduceItem {
  return {
    id: parseParquetString(row.id),
    date: parseParquetString(row.date),
    name: parseParquetString(row.name),
    price: parseParquetNumber(row.price),
    unit: parseParquetUnit(row.unit),
    isOrganic: parseParquetBoolean(row.is_organic),
    isIpm: parseParquetBoolean(row.is_ipm),
    isWaxed: parseParquetBoolean(row.is_waxed),
    isLocal: parseParquetBoolean(row.is_local),
    isHydroponic: parseParquetBoolean(row.is_hydroponic),
    origin: parseParquetString(row.origin),
  };
}

async function loadParquetItemsFromBlobUrl(url: string): Promise<ProduceItem[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch existing parquet: HTTP ${response.status}`);
  }

  const parquetBuffer = Buffer.from(await response.arrayBuffer());
  const reader = await ParquetReader.openBuffer(parquetBuffer);
  const cursor = reader.getCursor();
  const items: ProduceItem[] = [];

  try {
    while (true) {
      const row = (await cursor.next()) as Record<string, unknown> | null;
      if (!row) break;
      items.push(toProduceItemFromParquetRow(row));
    }
  } finally {
    await reader.close();
  }

  return items;
}

function pickNewestBlob<T extends { uploadedAt: string | Date }>(blobs: T[]): T {
  return blobs.reduce((latest, blob) => {
    const latestTs = new Date(latest.uploadedAt).getTime();
    const blobTs = new Date(blob.uploadedAt).getTime();
    return blobTs > latestTs ? blob : latest;
  });
}

function isoDateToMs(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00`).getTime();
}

function msToIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function clampIsoDateFloor(isoDate: string, floorIsoDate: string): string {
  return isoDate < floorIsoDate ? floorIsoDate : isoDate;
}

function filterByDateRange(
  items: ProduceItem[],
  startIsoDate: string,
  endIsoDateInclusive: string,
): ProduceItem[] {
  return items.filter((item) => item.date >= startIsoDate && item.date <= endIsoDateInclusive);
}

function downsampleByDayBucket(items: ProduceItem[], bucketDays: number): ProduceItem[] {
  const byName = new Map<string, ProduceItem[]>();
  for (const item of items) {
    const existing = byName.get(item.name) ?? [];
    existing.push(item);
    byName.set(item.name, existing);
  }

  const sampled: ProduceItem[] = [];
  const bucketMs = bucketDays * DAY_MS;

  for (const series of byName.values()) {
    series.sort((a, b) => a.date.localeCompare(b.date));

    let activeBucket: number | null = null;
    for (const item of series) {
      const itemBucket = Math.floor(isoDateToMs(item.date) / bucketMs);
      if (itemBucket !== activeBucket) {
        sampled.push(item);
        activeBucket = itemBucket;
      }
    }
  }

  sampled.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.name.localeCompare(b.name);
  });

  return sampled;
}

function downsampleMonthlyFirst(items: ProduceItem[]): ProduceItem[] {
  const byName = new Map<string, ProduceItem[]>();
  for (const item of items) {
    const existing = byName.get(item.name) ?? [];
    existing.push(item);
    byName.set(item.name, existing);
  }

  const sampled: ProduceItem[] = [];

  for (const series of byName.values()) {
    series.sort((a, b) => a.date.localeCompare(b.date));
    let activeMonth: string | null = null;

    for (const item of series) {
      const monthKey = item.date.slice(0, 7);
      if (monthKey !== activeMonth) {
        sampled.push(item);
        activeMonth = monthKey;
      }
    }
  }

  sampled.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.name.localeCompare(b.name);
  });

  return sampled;
}

async function loadAllYearlyProduceItems(): Promise<ProduceItem[]> {
  const { blobs } = await list({
    prefix: 'produce-data-yearly/',
    token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  });

  const byYear = new Map<string, (typeof blobs)[number]>();
  for (const blob of blobs) {
    const match = blob.pathname.match(/^produce-data-yearly\/(\d{4})-[a-f0-9]{7}\.parquet$/);
    if (!match) continue;
    const year = match[1];
    const previousBlob = byYear.get(year);
    if (!previousBlob) {
      byYear.set(year, blob);
      continue;
    }
    if (new Date(blob.uploadedAt).getTime() > new Date(previousBlob.uploadedAt).getTime()) {
      byYear.set(year, blob);
    }
  }

  const yearlyBlobs = Array.from(byYear.values()).sort((a, b) =>
    a.pathname.localeCompare(b.pathname),
  );

  const itemsByYear = await Promise.all(
    yearlyBlobs.map((blob) => loadParquetItemsFromBlobUrl(blob.url)),
  );
  const allItems = itemsByYear.flat();
  allItems.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.name.localeCompare(b.name);
  });
  return allItems;
}

async function putDerivedParquet(
  slug: string,
  items: ProduceItem[],
): Promise<{ url: string; rows: number }> {
  const buffer = await generateParquetBuffer(items);
  const version = randomBytes(4).toString('hex').slice(0, 7);
  const pathname = `${DERIVED_PREFIX}${slug}-${version}.parquet`;
  const parquetBlob = await put(pathname, buffer, {
    contentType: 'application/octet-stream',
    access: 'public',
    token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  });

  const { blobs } = await list({
    prefix: `${DERIVED_PREFIX}${slug}`,
    token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  });

  const stalePathnames = blobs
    .map((blob) => blob.pathname)
    .filter(
      (path) =>
        path !== parquetBlob.pathname &&
        new RegExp(`^${DERIVED_PREFIX}${slug}-[a-f0-9]{7}\\.parquet$`).test(path),
    );

  if (stalePathnames.length > 0) {
    await del(stalePathnames, {
      token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
    });
  }

  return { url: parquetBlob.url, rows: items.length };
}

export async function regenerateDerivedProduceParquets(): Promise<{
  ytd: { url: string; rows: number };
  longRangeDownsampled: { url: string; rows: number };
}> {
  const allItems = await loadAllYearlyProduceItems();
  if (allItems.length === 0) {
    throw new Error('No yearly produce rows found to build derived parquet datasets');
  }

  const maxDate = allItems[allItems.length - 1].date;
  const maxMs = isoDateToMs(maxDate);
  const ytdStart = `${maxDate.slice(0, 4)}-01-01`;
  const fiveYearStart = clampIsoDateFloor(msToIsoDate(maxMs - 1825 * DAY_MS), SINCE_2013_START);
  const tenYearStart = clampIsoDateFloor(msToIsoDate(maxMs - 3650 * DAY_MS), SINCE_2013_START);

  // YTD is a dedicated high-resolution dataset refreshed by cron.
  const ytdItems = filterByDateRange(allItems, ytdStart, maxDate);

  // Long-range dataset is a single union of downsampled points used for 5Y/10Y/Since 2013 views.
  const fiveYearWeeklyBase = filterByDateRange(allItems, fiveYearStart, maxDate);
  const tenYearBiweeklyBase = filterByDateRange(allItems, tenYearStart, maxDate);
  const since2013MonthlyBase = filterByDateRange(allItems, SINCE_2013_START, maxDate);
  const ytdWeeklyBase = filterByDateRange(allItems, ytdStart, maxDate);

  const fiveYearWeekly = downsampleByDayBucket(fiveYearWeeklyBase, 7);
  const tenYearBiweekly = downsampleByDayBucket(tenYearBiweeklyBase, 14);
  const since2013Monthly = downsampleMonthlyFirst(since2013MonthlyBase);
  const ytdWeekly = downsampleByDayBucket(ytdWeeklyBase, 7);

  const longRangeDeduped = Array.from(
    new Map(
      [...fiveYearWeekly, ...tenYearBiweekly, ...since2013Monthly, ...ytdWeekly].map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ).sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.name.localeCompare(b.name);
  });

  const [ytd, longRangeDownsampled] = await Promise.all([
    putDerivedParquet('ytd', ytdItems),
    putDerivedParquet('long-range-downsampled', longRangeDeduped),
  ]);

  return {
    ytd,
    longRangeDownsampled,
  };
}

export async function regenerateYtdDerivedParquet(): Promise<{ url: string; rows: number }> {
  const allItems = await loadAllYearlyProduceItems();
  if (allItems.length === 0) {
    throw new Error('No yearly produce rows found to build YTD parquet dataset');
  }

  const maxDate = allItems[allItems.length - 1].date;
  const ytdStart = `${maxDate.slice(0, 4)}-01-01`;
  const ytdItems = filterByDateRange(allItems, ytdStart, maxDate);
  return putDerivedParquet('ytd', ytdItems);
}

export async function upsertYearParquetForDate(
  year: string,
  date: string,
  newItemsForDate: ProduceItem[],
): Promise<{
  url: string;
  totalRows: number;
  replacedRows: number;
  appendedRows: number;
}> {
  const { blobs } = await list({
    prefix: `produce-data-yearly/${year}`,
    token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  });

  const yearParquetBlobs = blobs.filter((blob) =>
    new RegExp(`^produce-data-yearly/${year}(?:-[^.]+)?\\.parquet$`).test(blob.pathname),
  );

  let existingItems: ProduceItem[] = [];
  if (yearParquetBlobs.length > 0) {
    const newestBlob = pickNewestBlob(yearParquetBlobs);
    existingItems = await loadParquetItemsFromBlobUrl(newestBlob.url);
  }

  const keptItems = existingItems.filter((item) => item.date !== date);
  const replacedRows = existingItems.length - keptItems.length;
  const nextItems = [...keptItems, ...newItemsForDate];

  const nextBuffer = await generateParquetBuffer(nextItems);
  const version = randomBytes(4).toString('hex').slice(0, 7);
  const parquetBlob = await put(`produce-data-yearly/${year}-${version}.parquet`, nextBuffer, {
    contentType: 'application/octet-stream',
    access: 'public',
    token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  });

  const stalePathnames = yearParquetBlobs
    .map((blob) => blob.pathname)
    .filter((pathname) => pathname !== parquetBlob.pathname);

  if (stalePathnames.length > 0) {
    await del(stalePathnames, {
      token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
    });
  }

  return {
    url: parquetBlob.url,
    totalRows: nextItems.length,
    replacedRows,
    appendedRows: newItemsForDate.length,
  };
}
