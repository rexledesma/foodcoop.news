import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { unstable_cache } from 'next/cache';

function getCurrentYear() {
  return new Date()
    .toLocaleDateString('en-CA', {
      timeZone: 'America/New_York',
    })
    .slice(0, 4);
}

async function loadProduceMetadata() {
  const { blobs } = await list({
    prefix: 'produce-data-yearly/',
    token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  });

  const currentYear = getCurrentYear();
  const previousYear = String(Number.parseInt(currentYear, 10) - 1);
  const allowedYears = new Set([previousYear, currentYear]);

  const byYear = new Map<string, (typeof blobs)[number]>();
  for (const blob of blobs) {
    const match = blob.pathname.match(/produce-data-yearly\/(\d{4})-[a-f0-9]{7}\.parquet$/);
    if (!match) continue;
    const year = match[1];
    if (!allowedYears.has(year)) continue;

    const previousBlob = byYear.get(year);
    if (!previousBlob) {
      byYear.set(year, blob);
      continue;
    }

    if (new Date(blob.uploadedAt).getTime() > new Date(previousBlob.uploadedAt).getTime()) {
      byYear.set(year, blob);
    }
  }

  const years = Array.from(byYear.entries())
    .map(([year, blob]) => ({
      year,
      url: blob.url,
      size: blob.size,
      isCurrentYear: year === currentYear,
    }))
    .sort((a, b) => b.year.localeCompare(a.year));

  return { years };
}

export async function GET() {
  try {
    const cached = unstable_cache(loadProduceMetadata, ['produce-metadata'], {
      revalidate: 86400,
      tags: ['produce-metadata'],
    });
    const data = await cached();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Produce metadata error:', error);
    return NextResponse.json({ error: 'Failed to list produce data' }, { status: 500 });
  }
}
