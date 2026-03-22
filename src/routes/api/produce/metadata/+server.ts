import { getCachedProduceMetadata } from '@/lib/produce-metadata-cache';
import { list } from '@/lib/s3-storage';

function getCurrentYear(): string {
  return new Date()
    .toLocaleDateString('en-CA', {
      timeZone: 'America/New_York',
    })
    .slice(0, 4);
}

const DERIVED_PATH_PATTERNS = {
  ytd: /^produce-data-derived\/ytd-[a-f0-9]{7}\.parquet$/,
  longRangeDownsampled: /^produce-data-derived\/long-range-downsampled-[a-f0-9]{7}\.parquet$/,
} as const;

type DerivedKey = keyof typeof DERIVED_PATH_PATTERNS;

function pickLatestBlob<T extends { uploadedAt: string | Date }>(blobs: T[]): T {
  return blobs.reduce(
    (latest, blob): T =>
      new Date(blob.uploadedAt).getTime() > new Date(latest.uploadedAt).getTime() ? blob : latest,
  );
}

async function loadProduceMetadata(): Promise<{
  years: { year: string; url: string; size: number; isCurrentYear: boolean }[];
  derived: Record<'ytd' | 'longRangeDownsampled', { url: string; size: number } | null>;
}> {
  const [{ blobs: yearlyBlobs }, { blobs: derivedBlobs }] = await Promise.all([
    list({
      prefix: 'produce-data-yearly/',
    }),
    list({
      prefix: 'produce-data-derived/',
    }),
  ]);

  const currentYear = getCurrentYear();
  const earliestSupportedYear = 2013;
  const currentYearNum = Number.parseInt(currentYear, 10);

  const byYear = new Map<string, (typeof yearlyBlobs)[number]>();
  for (const blob of yearlyBlobs) {
    const match = blob.pathname.match(/produce-data-yearly\/(\d{4})-[a-f0-9]{7}\.parquet$/);
    if (!match) {
      continue;
    }
    const year = match[1];
    if (!year) {
      continue;
    }
    const yearNum = Number.parseInt(year, 10);
    if (Number.isNaN(yearNum) || yearNum < earliestSupportedYear || yearNum > currentYearNum) {
      continue;
    }

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
    .map(([year, blob]): { year: string; url: string; size: number; isCurrentYear: boolean } => ({
      year,
      url: blob.url,
      size: blob.size,
      isCurrentYear: year === currentYear,
    }))
    .sort((a, b): number => b.year.localeCompare(a.year));

  const derived = Object.fromEntries(
    (Object.keys(DERIVED_PATH_PATTERNS) as DerivedKey[]).map(
      (
        key,
      ):
        | ['ytd' | 'longRangeDownsampled', null]
        | ['ytd' | 'longRangeDownsampled', { url: string; size: number }] => {
        const matchingDerivedBlobs = derivedBlobs.filter((blob): boolean =>
          DERIVED_PATH_PATTERNS[key].test(blob.pathname),
        );
        if (matchingDerivedBlobs.length === 0) {
          return [key, null];
        }
        const latest = pickLatestBlob(matchingDerivedBlobs);
        return [
          key,
          {
            url: latest.url,
            size: latest.size,
          },
        ];
      },
    ),
  ) as Record<DerivedKey, { url: string; size: number } | null>;

  return { years, derived };
}

export async function GET(): Promise<Response> {
  try {
    const data = await getCachedProduceMetadata(loadProduceMetadata);

    return Response.json(data);
  } catch (error) {
    console.error('Produce metadata error:', error);
    return Response.json({ error: 'Failed to list produce data' }, { status: 500 });
  }
}
