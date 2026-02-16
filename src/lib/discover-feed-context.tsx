'use client';

import { createContext, useContext } from 'react';
import type { FeedItem } from '@/lib/discover-feed';

export type { FeedItem } from '@/lib/discover-feed';

export interface DiscoverFeedState {
  items: FeedItem[];
  loading: boolean;
  error: string;
  pendingSources: number;
  hasLoadedOnce: boolean;
  fetchFeeds: () => void;
}

const DiscoverFeedContext = createContext<DiscoverFeedState | null>(null);

export function useDiscoverFeedContext(): DiscoverFeedState {
  const context = useContext(DiscoverFeedContext);
  if (!context) {
    throw new Error('useDiscoverFeedContext must be used within DiscoverFeedProvider');
  }
  return context;
}

export { DiscoverFeedContext };
