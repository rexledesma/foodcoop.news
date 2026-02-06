'use client';

import { ReactNode, useMemo } from 'react';
import { useProduceData } from '@/lib/use-produce-data';
import { ProduceDataContext, type ProduceDataState } from '@/lib/produce-data-context';

export function ProduceDataProvider({ children }: { children: ReactNode }) {
  const { data, history, dateRange, isLoading, error } = useProduceData();

  const value = useMemo<ProduceDataState>(
    () => ({ data, history, dateRange, isLoading, error }),
    [data, history, dateRange, isLoading, error],
  );

  return <ProduceDataContext.Provider value={value}>{children}</ProduceDataContext.Provider>;
}
