import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { unstable_cache } from 'next/cache';

function getCurrentMonth() {
  return new Date()
    .toLocaleDateString('en-CA', {
      timeZone: 'America/New_York',
    })
    .slice(0, 7);
}

async function loadProduceMetadata() {
  const { blobs } = await list({
    prefix: 'produce-data/',
    token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  });

  const currentMonth = getCurrentMonth();

  const months = blobs
    .filter((blob) => blob.pathname.endsWith('.parquet'))
    .map((blob) => {
      const match = blob.pathname.match(/produce-data\/(\d{4}-\d{2})\.parquet$/);
      if (!match) return null;

      const month = match[1];
      return {
        month,
        url: blob.url,
        size: blob.size,
        isCurrentMonth: month === currentMonth,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.month.localeCompare(a!.month));

  return { months };
}

export async function GET() {
  try {
    const cached = unstable_cache(loadProduceMetadata, ['produce-metadata'], {
      revalidate: 86400,
      tags: ['produce-metadata'],
    });
    const data = await cached();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Produce metadata error:', error);
    return NextResponse.json({ error: 'Failed to list produce data' }, { status: 500 });
  }
}
