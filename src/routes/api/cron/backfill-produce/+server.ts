import { list } from '@/lib/s3-storage';
import { invalidateProduceMetadataCache } from '@/lib/produce-metadata-cache';
import {
  regenerateDerivedProduceParquets,
  regenerateMonthParquet,
} from '@/lib/produce-parquet-utils';
import { CRON_SECRET } from '$env/static/private';

// POST /api/cron/backfill-produce
// Regenerates all monthly parquet files from stored HTML snapshots
export async function POST({ request }: { request: Request }): Promise<Response> {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // List all HTML blobs
    const { blobs } = await list({
      prefix: 'produce/',
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

    const derived = await regenerateDerivedProduceParquets();

    invalidateProduceMetadataCache();

    const totalItems = results.reduce((sum, r): number => sum + r.itemCount, 0);

    return Response.json({
      success: true,
      months: results,
      totalItems,
      derived,
    });
  } catch (error) {
    console.error('Backfill produce error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
