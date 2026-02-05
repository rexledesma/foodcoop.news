'use client';

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  FeedPost,
  GazetteArticle,
  FoodCoopAnnouncement,
  FoodCoopCooksArticle,
  EventbriteEvent,
  FoodcoopEvent,
} from '@/lib/types';
import {
  DiscoverFeedContext,
  getFeedItemKey,
  type FeedItem,
  type DiscoverFeedState,
} from '@/lib/discover-feed-context';
import { useProduceDataContext } from '@/lib/produce-data-context';
import { produceRowsToFeedItems } from '@/lib/produce-feed-utils';

const COOP_BLUESKY_HANDLE = 'foodcoop.bsky.social';

export function DiscoverFeedProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingSources, setPendingSources] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const hasItemsRef = useRef(false);
  const hasSuccessRef = useRef(false);
  const finalizedRef = useRef(false);

  const { data: produceData } = useProduceDataContext();

  const fetchFeeds = useCallback(() => {
    setHasLoadedOnce(true);

    try {
      setLoading(true);
      setError('');
      hasItemsRef.current = false;
      hasSuccessRef.current = false;
      finalizedRef.current = false;
      setItems([]);

      const fortyFiveDaysAgo = new Date();
      fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);

      const fortyFiveDaysAhead = new Date();
      fortyFiveDaysAhead.setDate(fortyFiveDaysAhead.getDate() + 45);

      const sortAndPrune = (list: FeedItem[]) =>
        [...list]
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .filter((item) => item.date >= fortyFiveDaysAgo && item.date <= fortyFiveDaysAhead);

      const appendItems = (newItems: FeedItem[]) => {
        setItems((prev) => {
          if (newItems.length === 0) return sortAndPrune(prev);
          const seen = new Set(prev.map(getFeedItemKey));
          const filtered = newItems.filter(
            (item) =>
              item.date >= fortyFiveDaysAgo &&
              item.date <= fortyFiveDaysAhead &&
              !seen.has(getFeedItemKey(item)),
          );
          if (filtered.length === 0) return sortAndPrune(prev);
          const merged = [...prev, ...filtered];
          if (!hasItemsRef.current && merged.length > 0) {
            hasItemsRef.current = true;
            setLoading(false);
          }
          return sortAndPrune(merged);
        });
      };

      const sources = [
        {
          key: 'gazette',
          url: '/api/gazette',
          map: (data: { articles: GazetteArticle[] }) =>
            data.articles.map((article) => ({
              type: 'gazette' as const,
              data: article,
              date: new Date(article.pubDate),
            })),
        },
        {
          key: 'bluesky',
          url: '/api/feed',
          map: (data: { posts: FeedPost[] }) =>
            data.posts
              .filter((post) => {
                if (!post.repostedBy) return true;
                if (post.repostedBy.handle !== COOP_BLUESKY_HANDLE) return false;
                return post.author.handle !== COOP_BLUESKY_HANDLE;
              })
              .map((post) => ({
                type: 'bluesky' as const,
                data: post,
                date: new Date(post.createdAt),
              })),
        },
        {
          key: 'foodcoop',
          url: '/api/foodcoop',
          map: (data: { articles: FoodCoopAnnouncement[] }) =>
            data.articles.map((announcement) => ({
              type: 'foodcoop' as const,
              data: announcement,
              date: new Date(announcement.pubDate),
            })),
        },
        {
          key: 'foodcoopcooks',
          url: '/api/foodcoopcooks',
          map: (data: { articles: FoodCoopCooksArticle[] }) =>
            data.articles.map((article) => ({
              type: 'foodcoopcooks' as const,
              data: article,
              date: new Date(article.pubDate),
            })),
        },
        {
          key: 'foodcoopcooks-events',
          url: '/api/foodcoopcooks/events',
          map: (data: { events: EventbriteEvent[] }) =>
            data.events.map((event) => ({
              type: 'foodcoopcooks-events' as const,
              data: event,
              date: new Date(event.startUtc),
            })),
        },
        {
          key: 'wordsprouts-events',
          url: '/api/wordsprouts/events',
          map: (data: { events: EventbriteEvent[] }) =>
            data.events.map((event) => ({
              type: 'wordsprouts-events' as const,
              data: event,
              date: new Date(event.startUtc),
            })),
        },
        {
          key: 'concert-series-events',
          url: '/api/concert-series/events',
          map: (data: { events: EventbriteEvent[] }) =>
            data.events.map((event) => ({
              type: 'concert-series-events' as const,
              data: event,
              date: new Date(event.startUtc),
            })),
        },
        {
          key: 'gm-events',
          url: '/api/foodcoop/gm-events',
          map: (data: { events: FoodcoopEvent[] }) =>
            data.events.map((event) => ({
              type: 'gm-events' as const,
              data: event,
              date: new Date(event.startUtc),
            })),
        },
      ];

      setPendingSources(sources.length);

      const finalize = () => {
        if (finalizedRef.current) return;
        finalizedRef.current = true;
        setItems((prev) => sortAndPrune(prev));
        if (!hasSuccessRef.current) {
          setError('Failed to load feed');
        }
        setLoading(false);
      };

      for (const source of sources) {
        fetch(source.url)
          .then(async (response) => {
            if (!response.ok) return;
            hasSuccessRef.current = true;
            const data = await response.json();
            appendItems(source.map(data));
          })
          .catch(() => {
            // Ignore per-source errors; show overall error if all fail.
          })
          .finally(() => {
            setItems((prev) => sortAndPrune(prev));
            setPendingSources((prev) => {
              const next = Math.max(0, prev - 1);
              if (next === 0) finalize();
              return next;
            });
          });
      }
    } catch {
      setError('Failed to load feed');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasLoadedOnce) return;
    const loadTimeout = window.setTimeout(() => {
      fetchFeeds();
    }, 0);
    return () => window.clearTimeout(loadTimeout);
  }, [fetchFeeds, hasLoadedOnce]);

  // Combine feed items with produce data
  const combinedItems = useMemo(() => {
    if (produceData.length === 0) return items;

    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);

    const fortyFiveDaysAhead = new Date();
    fortyFiveDaysAhead.setDate(fortyFiveDaysAhead.getDate() + 45);

    const produceItems = produceRowsToFeedItems(produceData);
    const seen = new Set(items.map(getFeedItemKey));

    const filtered = produceItems.filter(
      (item) =>
        item.date >= fortyFiveDaysAgo &&
        item.date <= fortyFiveDaysAhead &&
        !seen.has(getFeedItemKey(item)),
    );

    if (filtered.length === 0) return items;

    const merged = [...items, ...filtered];
    return merged.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [items, produceData]);

  const value = useMemo<DiscoverFeedState>(
    () => ({
      items: combinedItems,
      loading,
      error,
      pendingSources,
      hasLoadedOnce,
      fetchFeeds,
    }),
    [combinedItems, loading, error, pendingSources, hasLoadedOnce, fetchFeeds],
  );

  return <DiscoverFeedContext.Provider value={value}>{children}</DiscoverFeedContext.Provider>;
}
