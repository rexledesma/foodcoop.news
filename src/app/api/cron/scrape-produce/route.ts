import { NextResponse } from 'next/server';
import { list, put } from '@vercel/blob';
import { parseProduceHtml } from '@/lib/produce-parser';
import { generateParquetBuffer } from '@/lib/parquet-generator';
import type { ProduceItem } from '@/lib/produce-types';

// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const maxRetries = 3;
    let lastError: unknown;
    let html: string | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch('https://www.foodcoop.com/produce');
        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status}`);
          continue;
        }
        html = await response.text();
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!html) {
      console.error('Failed to fetch produce page after retries:', lastError);
      return NextResponse.json({ error: 'Failed to fetch produce page' }, { status: 502 });
    }

    const date = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/New_York',
    }); // "YYYY-MM-DD"
    const month = date.slice(0, 7); // "YYYY-MM"

    // Store HTML snapshot
    const htmlBlob = await put(`produce/${date}.html`, html, {
      contentType: 'text/html',
      access: 'public',
      allowOverwrite: true,
      token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
    });

    // Regenerate Parquet for the current month
    const parquetResult = await regenerateMonthParquet(month);

    return NextResponse.json({
      success: true,
      htmlUrl: htmlBlob.url,
      htmlSize: html.length,
      parquet: parquetResult,
    });
  } catch (error) {
    console.error('Scrape produce error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function regenerateMonthParquet(month: string): Promise<{
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
