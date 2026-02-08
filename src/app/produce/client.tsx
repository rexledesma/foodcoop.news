'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useProduceDataContext } from '@/lib/produce-data-context';

const ProduceAnalytics = dynamic(
  () => import('@/components/ProduceAnalytics').then((mod) => mod.ProduceAnalytics),
  { ssr: false },
);

export function ProducePageClient() {
  const { data, history, dateRange, isLoading, error } = useProduceDataContext();
  const searchParams = useSearchParams();
  const initialDateFilter = searchParams.get('date');
  const initialItemFilter = searchParams.get('item');

  return (
    <ProduceAnalytics
      data={data}
      history={history}
      dateRange={dateRange}
      isLoading={isLoading}
      error={error}
      initialDateFilter={initialDateFilter}
      initialItemFilter={initialItemFilter}
    />
  );
}
