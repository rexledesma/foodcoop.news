import { fetchAuthQueryFromHeaders, isUnauthenticatedError } from '@/lib/auth';
import { parseProduceHtml } from '@/lib/produce-parser';
import { list } from '@/lib/s3-storage';
import { api } from '../../../../../../convex/_generated/api';

const SNAPSHOT_CACHE_DURATION_MS = 5 * 60 * 1000;

type LatestSnapshot = {
  names: Set<string>;
  snapshotDate: string | null;
};

type SnapshotCache = {
  payload: LatestSnapshot | null;
  cachedAt: number;
  revalidation: Promise<void> | null;
};

const snapshotCache: SnapshotCache = {
  payload: null,
  cachedAt: 0,
  revalidation: null,
};

function isNotAuthenticated(error: unknown): boolean {
  if (isUnauthenticatedError(error)) {
    return true;
  }
  return error instanceof Error && error.message.includes('Not authenticated');
}

async function loadLatestSnapshot(): Promise<LatestSnapshot> {
  const { blobs } = await list({
    prefix: 'produce/',
  });

  const htmlBlobs = blobs.filter((blob): boolean =>
    /produce\/\d{4}-\d{2}-\d{2}\.html$/.test(blob.pathname),
  );
  if (htmlBlobs.length === 0) {
    return { names: new Set(), snapshotDate: null };
  }

  const latest = htmlBlobs.reduce((currentLatest, blob) => {
    if (!currentLatest) {
      return blob;
    }
    return new Date(blob.uploadedAt).getTime() > new Date(currentLatest.uploadedAt).getTime()
      ? blob
      : currentLatest;
  }, htmlBlobs[0]);

  const dateMatch = latest.pathname.match(/produce\/(\d{4}-\d{2}-\d{2})\.html$/);
  const snapshotDate = dateMatch?.[1] ?? null;
  if (!snapshotDate) {
    return { names: new Set(), snapshotDate: null };
  }

  const response = await fetch(latest.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch latest produce snapshot: HTTP ${response.status}`);
  }

  const html = await response.text();
  const parsed = parseProduceHtml(html, snapshotDate);

  const names = new Set<string>();
  for (const item of parsed.items) {
    const name = item.name.trim();
    if (!name) {
      continue;
    }
    names.add(name);
  }

  return { names, snapshotDate };
}

const startRevalidation = (): Promise<void> => {
  if (snapshotCache.revalidation) {
    return snapshotCache.revalidation;
  }

  snapshotCache.revalidation = (async (): Promise<void> => {
    const payload = await loadLatestSnapshot();
    snapshotCache.payload = payload;
    snapshotCache.cachedAt = Date.now();
  })()
    .catch((error): void => {
      console.error('Produce favorites summary snapshot revalidation failed:', error);
    })
    .finally((): void => {
      snapshotCache.revalidation = null;
    });

  return snapshotCache.revalidation;
};

async function getLatestSnapshotCached(): Promise<LatestSnapshot> {
  const now = Date.now();
  const age = snapshotCache.payload ? now - snapshotCache.cachedAt : Number.POSITIVE_INFINITY;

  if (snapshotCache.payload && age < SNAPSHOT_CACHE_DURATION_MS) {
    return snapshotCache.payload;
  }

  if (snapshotCache.payload) {
    void startRevalidation();
    return snapshotCache.payload;
  }

  if (snapshotCache.revalidation) {
    await snapshotCache.revalidation;
  } else {
    await startRevalidation();
  }

  if (snapshotCache.payload) {
    return snapshotCache.payload;
  }

  throw new Error('No produce snapshot available');
}

export async function GET({ request }: { request: Request }): Promise<Response> {
  try {
    const favorites = await fetchAuthQueryFromHeaders(
      request.headers,
      api.produceFavorites.getUserFavorites,
      {},
    );

    const favoriteNames = Array.from(
      new Set(
        favorites
          .filter((name): name is string => typeof name === 'string')
          .map((name): string => name.trim())
          .filter((name): boolean => name.length > 0),
      ),
    );

    const snapshot = await getLatestSnapshotCached();

    let inStockCount = 0;
    for (const favorite of favoriteNames) {
      if (snapshot.names.has(favorite)) {
        inStockCount += 1;
      }
    }

    const favoritesCount = favoriteNames.length;

    return Response.json({
      favoritesCount,
      inStockCount,
      outOfStockCount: Math.max(0, favoritesCount - inStockCount),
      snapshotDate: snapshot.snapshotDate,
    });
  } catch (error) {
    if (isNotAuthenticated(error)) {
      return Response.json(
        {
          favoritesCount: 0,
          inStockCount: 0,
          outOfStockCount: 0,
          snapshotDate: null,
        },
        { status: 401 },
      );
    }

    console.error('Failed to load produce favorites summary:', error);
    return Response.json({ error: 'Failed to load produce favorites summary' }, { status: 500 });
  }
}
