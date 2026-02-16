import type { ProduceDateRange, ProduceHistoryPoint, ProduceRow } from '@/lib/produce-types';

type ProduceDataApiResponse = {
  data: ProduceRow[];
  history: Array<[string, ProduceHistoryPoint[]]>;
  dateRange: ProduceDateRange | null;
};

export async function loadProduceData(options?: { includeLongRange?: boolean }): Promise<{
  data: ProduceRow[];
  history: Map<string, ProduceHistoryPoint[]>;
  dateRange: ProduceDateRange | null;
}> {
  const params = new URLSearchParams();
  if (options?.includeLongRange) params.set('includeLongRange', '1');
  const response = await fetch(
    params.size > 0 ? `/api/produce/data?${params.toString()}` : '/api/produce/data',
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch server produce data: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as ProduceDataApiResponse;
  return {
    data: payload.data,
    history: new Map(payload.history),
    dateRange: payload.dateRange,
  };
}
