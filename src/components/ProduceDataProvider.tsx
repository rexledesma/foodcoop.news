'use client';

import { ReactNode, useMemo } from 'react';
import { useProduceData } from '@/lib/use-produce-data';
import { ProduceDataContext, type ProduceDataState } from '@/lib/produce-data-context';

export function ProduceDataProvider({ children }: { children: ReactNode }) {
  const { data, history, isLoading, error } = useProduceData();

  const value = useMemo<ProduceDataState>(
    () => ({ data, history, isLoading, error }),
    [data, history, isLoading, error],
  );

  return <ProduceDataContext.Provider value={value}>{children}</ProduceDataContext.Provider>;
}
