import type { ProduceDateRange, ProduceHistoryPoint, ProduceRow } from '@/lib/produce-types';

type ProduceDataApiResponse = {
  data: ProduceRow[];
  history: Array<[string, ProduceHistoryPoint[]]>;
  dateRange: ProduceDateRange | null;
};

export async function loadProduceData(): Promise<{
  data: ProduceRow[];
  history: Map<string, ProduceHistoryPoint[]>;
  dateRange: ProduceDateRange | null;
}> {
  const response = await fetch('/api/produce/data');
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
