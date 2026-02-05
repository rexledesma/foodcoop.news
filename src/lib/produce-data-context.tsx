'use client';

import { createContext, useContext } from 'react';
import type { ProduceHistoryMap, ProduceRow } from '@/lib/use-produce-data';

export interface ProduceDataState {
  data: ProduceRow[];
  history: ProduceHistoryMap;
  isLoading: boolean;
  error: string | null;
}

const ProduceDataContext = createContext<ProduceDataState | null>(null);

export function useProduceDataContext(): ProduceDataState {
  const context = useContext(ProduceDataContext);
  if (!context) {
    throw new Error('useProduceDataContext must be used within ProduceDataProvider');
  }
  return context;
}

export { ProduceDataContext };
