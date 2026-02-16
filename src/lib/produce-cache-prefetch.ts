import { readProduceCache, writeProduceCache } from '@/lib/produce-cache';
import { loadProduceData } from '@/lib/produce-data-api-loader';

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
      const loaded = await loadProduceData();
      writeProduceCache(loaded.data, loaded.history, loaded.dateRange);
    } catch (error) {
      console.error('Failed to prefetch produce cache:', error);
    } finally {
      prefetchPromise = null;
    }
  })();

  return prefetchPromise;
}
