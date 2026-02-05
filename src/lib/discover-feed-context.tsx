'use client';

import { createContext, useContext } from 'react';
import type {
  FeedPost,
  GazetteArticle,
  FoodCoopAnnouncement,
  FoodCoopCooksArticle,
  EventbriteEvent,
  FoodcoopEvent,
  ProduceEvent,
} from '@/lib/types';

export type FeedItem =
  | { type: 'gazette'; data: GazetteArticle; date: Date }
  | { type: 'bluesky'; data: FeedPost; date: Date }
  | { type: 'foodcoop'; data: FoodCoopAnnouncement; date: Date }
  | { type: 'foodcoopcooks'; data: FoodCoopCooksArticle; date: Date }
  | { type: 'foodcoopcooks-events'; data: EventbriteEvent; date: Date }
  | { type: 'wordsprouts-events'; data: EventbriteEvent; date: Date }
  | { type: 'concert-series-events'; data: EventbriteEvent; date: Date }
  | { type: 'gm-events'; data: FoodcoopEvent; date: Date }
  | { type: 'produce'; data: ProduceEvent; date: Date };

export function getFeedItemKey(item: FeedItem) {
  if (item.type === 'gazette') return `gazette-${item.data.id}`;
  if (item.type === 'foodcoop') return `foodcoop-${item.data.id}`;
  if (item.type === 'foodcoopcooks') return `foodcoopcooks-${item.data.id}`;
  if (item.type === 'foodcoopcooks-events') {
    return `foodcoopcooks-event-${item.data.id}`;
  }
  if (item.type === 'wordsprouts-events') {
    return `wordsprouts-event-${item.data.id}`;
  }
  if (item.type === 'concert-series-events') {
    return `concert-series-event-${item.data.id}`;
  }
  if (item.type === 'gm-events') {
    return `gm-event-${item.data.id}`;
  }
  if (item.type === 'produce') {
    return `produce-${item.data.id}`;
  }
  return item.data.repostedBy
    ? `bluesky-${item.data.id}-repost-${item.data.repostedBy.handle}`
    : `bluesky-${item.data.id}`;
}

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
