import { del, list, put } from '@vercel/blob';
import { ParquetReader } from '@dsnp/parquetjs';
import { randomBytes } from 'crypto';
import { parseProduceHtml } from '@/lib/produce-parser';
import { generateParquetBuffer } from '@/lib/parquet-generator';
import type { ProduceItem } from '@/lib/types';

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

function toProduceItemFromParquetRow(row: Record<string, unknown>): ProduceItem {
  return {
    id: String(row.id ?? ''),
    date: String(row.date ?? ''),
    name: String(row.name ?? ''),
    price: parseParquetNumber(row.price),
    unit: String(row.unit ?? 'each') as ProduceItem['unit'],
    isOrganic: parseParquetBoolean(row.is_organic),
    isIpm: parseParquetBoolean(row.is_ipm),
    isWaxed: parseParquetBoolean(row.is_waxed),
    isLocal: parseParquetBoolean(row.is_local),
    isHydroponic: parseParquetBoolean(row.is_hydroponic),
    origin: String(row.origin ?? ''),
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
