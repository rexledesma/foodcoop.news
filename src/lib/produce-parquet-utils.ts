import { del, list, put } from '@vercel/blob';
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
