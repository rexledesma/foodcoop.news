'use client';

import { useEffect, useMemo, useRef } from 'react';
import SvelteMount from '@/components/SvelteMount';
import ProduceAnalyticsView from '@/components/produce/ProduceAnalytics.svelte';
import { useScrollVisibility } from '@/components/ScrollVisibilityProvider';
import { useProduceFavorites } from '@/lib/use-produce-favorites';
import type {
  ProduceDateRange,
  ProduceHistoryMap,
  ProduceRow,
  ProduceSWRPeriod,
} from '@/lib/use-produce-data';

interface ProduceAnalyticsProps {
  data: ProduceRow[];
  history: ProduceHistoryMap;
  dateRange: ProduceDateRange | null;
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: string | null;
  revalidateForPeriod: (period: ProduceSWRPeriod) => void;
  initialDateFilter?: string | null;
  initialItemFilter?: string | null;
  initialProduceFilter?: string | null;
}

export function ProduceAnalytics({
  data,
  history,
  dateRange,
  isLoading,
  isRefreshing,
  error,
  revalidateForPeriod,
  initialDateFilter,
  initialItemFilter,
  initialProduceFilter,
}: ProduceAnalyticsProps) {
  const { showSticky } = useScrollVisibility();
  const { favorites, toggleFavorite } = useProduceFavorites();
  const channelRef = useRef<string>(`produce-analytics-${Math.random().toString(36).slice(2)}`);

  const favoritesSnapshot = useMemo(() => JSON.stringify(Array.from(favorites)), [favorites]);

  const state = useMemo(
    () => ({
      data,
      history,
      dateRange,
      isLoading: isLoading ?? false,
      isRefreshing: isRefreshing ?? false,
      error: error ?? '',
      revalidateForPeriod,
      initialDateFilter: initialDateFilter ?? null,
      initialItemFilter: initialItemFilter ?? null,
      initialProduceFilter: initialProduceFilter ?? null,
      showSticky,
      favoritesSnapshot,
      toggleFavorite,
    }),
    [
      data,
      history,
      dateRange,
      isLoading,
      isRefreshing,
      error,
      revalidateForPeriod,
      initialDateFilter,
      initialItemFilter,
      initialProduceFilter,
      showSticky,
      favoritesSnapshot,
      toggleFavorite,
    ],
  );

  const initialStateRef = useRef(state);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(`produce-analytics-state:update:${channelRef.current}`, {
        detail: state,
      }),
    );
  }, [state]);

  const props = useMemo(
    () => ({
      channel: channelRef.current,
      initialState: initialStateRef.current,
    }),
    [],
  );

  return <SvelteMount component={ProduceAnalyticsView} props={props} />;
}
