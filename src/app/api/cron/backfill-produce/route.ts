import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { revalidateTag } from 'next/cache';
import { regenerateMonthParquet } from '@/lib/produce-parquet-utils';

// POST /api/cron/backfill-produce
// Regenerates all monthly parquet files from stored HTML snapshots
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // List all HTML blobs
    const { blobs } = await list({
      prefix: 'produce/',
      token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
    });

    // Extract unique months from filenames (produce/YYYY-MM-DD.html → YYYY-MM)
    const months = new Set<string>();
    for (const blob of blobs) {
      const match = blob.pathname.match(/produce\/(\d{4}-\d{2})-\d{2}\.html$/);
      if (match) {
        months.add(match[1]);
      }
    }

    const sortedMonths = Array.from(months).sort();
    const results: Array<{
      month: string;
      url: string;
      itemCount: number;
      daysCount: number;
    }> = [];

    // Regenerate parquet for each month
    for (const month of sortedMonths) {
      const result = await regenerateMonthParquet(month);
      results.push({ month, ...result });
    }

    revalidateTag('produce-metadata', { expire: 0 });

    const totalItems = results.reduce((sum, r) => sum + r.itemCount, 0);

    return NextResponse.json({
      success: true,
      months: results,
      totalItems,
    });
  } catch (error) {
    console.error('Backfill produce error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
