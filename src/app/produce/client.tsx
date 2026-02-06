'use client';

import dynamic from 'next/dynamic';
import { useProduceDataContext } from '@/lib/produce-data-context';

const ProduceAnalytics = dynamic(
  () => import('@/components/ProduceAnalytics').then((mod) => mod.ProduceAnalytics),
  { ssr: false },
);

export function ProducePageClient() {
  const { data, history, dateRange, isLoading, error } = useProduceDataContext();

  return (
    <ProduceAnalytics
      data={data}
      history={history}
      dateRange={dateRange}
      isLoading={isLoading}
      error={error}
    />
  );
}
