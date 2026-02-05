import { list, put } from '@vercel/blob';
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
  const parquetBlob = await put(`produce-data/${month}.parquet`, buffer, {
    contentType: 'application/octet-stream',
    access: 'public',
    allowOverwrite: true,
    token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  });

  return {
    url: parquetBlob.url,
    itemCount: allItems.length,
    daysCount,
  };
}
