const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

let cache: {
  data: unknown;
  expiresAt: number;
} | null = null;

export async function getCachedProduceMetadata<T>(loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.data as T;
  }

  const data = await loader();
  cache = {
    data,
    expiresAt: now + CACHE_DURATION_MS,
  };

  return data;
}

export function invalidateProduceMetadataCache(): void {
  cache = null;
}
