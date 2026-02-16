import { readProduceCache, writeProduceCache } from '@/lib/produce-cache';

let prefetchPromise: Promise<void> | null = null;

export function prefetchProduceCache(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (readProduceCache()) {
    return Promise.resolve();
  }

  if (prefetchPromise) {
    return prefetchPromise;
  }

  prefetchPromise = (async () => {
    try {
      const [{ DuckDBClient }, { loadProduceData }] = await Promise.all([
        import('@/lib/duckdb-client'),
        import('@/lib/produce-data-loader'),
      ]);

      const client = new DuckDBClient();
      try {
        await client.init();
        const loaded = await loadProduceData(client);
        writeProduceCache(loaded.data, loaded.history, loaded.dateRange);
      } finally {
        await client.close();
      }
    } catch (error) {
      console.error('Failed to prefetch produce cache:', error);
    } finally {
      prefetchPromise = null;
    }
  })();

  return prefetchPromise;
}
