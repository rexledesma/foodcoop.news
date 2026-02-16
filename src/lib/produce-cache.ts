import type { ProduceDateRange, ProduceHistoryPoint, ProduceRow } from '@/lib/produce-types';

const CACHE_KEY = 'produce-cache-v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface ProduceCachePayload {
  data: ProduceRow[];
  history: [string, ProduceHistoryPoint[]][];
  dateRange: ProduceDateRange | null;
  cachedAt: number;
}

interface ProduceCacheResult {
  data: ProduceRow[];
  history: Map<string, ProduceHistoryPoint[]>;
  dateRange: ProduceDateRange | null;
  cachedAt: number;
}

export function readProduceCache(): ProduceCacheResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const payload: ProduceCachePayload = JSON.parse(raw);
    if (!Array.isArray(payload.data) || !Array.isArray(payload.history)) return null;
    if (typeof payload.cachedAt !== 'number') return null;
    if (Date.now() - payload.cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return {
      data: payload.data,
      history: new Map(payload.history),
      dateRange: payload.dateRange,
      cachedAt: payload.cachedAt,
    };
  } catch {
    return null;
  }
}

export function writeProduceCache(
  data: ProduceRow[],
  history: Map<string, ProduceHistoryPoint[]>,
  dateRange: ProduceDateRange | null,
): void {
  try {
    const payload: ProduceCachePayload = {
      data,
      history: Array.from(history.entries()),
      dateRange,
      cachedAt: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('produce-cache-updated'));
    }
  } catch {
    // Silently ignore quota errors
  }
}

export function clearProduceCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Silently ignore storage errors
  }
}
