'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import SvelteMount from '@/components/SvelteMount';
import DiscoverFeedView from '@/components/discover/DiscoverFeed.svelte';
import { useScrollVisibility } from '@/components/ScrollVisibilityProvider';
import { useDiscoverFeedContext } from '@/lib/discover-feed-context';

const LOCAL_FAVORITES_KEY = 'produce-favorites';
const AUTH_FAVORITES_CACHE_KEY = 'produce-favorites-cache';

function subscribeToFavorites(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const handleStorage = (event: StorageEvent) => {
    if (event.key === LOCAL_FAVORITES_KEY || event.key === AUTH_FAVORITES_CACHE_KEY) {
      callback();
    }
  };
  const handleFavorites = () => callback();
  const handleFavoritesCache = () => callback();
  window.addEventListener('storage', handleStorage);
  window.addEventListener(LOCAL_FAVORITES_KEY, handleFavorites);
  window.addEventListener(AUTH_FAVORITES_CACHE_KEY, handleFavoritesCache);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(LOCAL_FAVORITES_KEY, handleFavorites);
    window.removeEventListener(AUTH_FAVORITES_CACHE_KEY, handleFavoritesCache);
  };
}

function getFavoritesSnapshot(): string {
  if (typeof window === 'undefined') return '[]';
  return (
    localStorage.getItem(LOCAL_FAVORITES_KEY) ??
    localStorage.getItem(AUTH_FAVORITES_CACHE_KEY) ??
    '[]'
  );
}

export function DiscoverFeed() {
  const channelRef = useRef<string>(`discover-${Math.random().toString(36).slice(2)}`);
  const { showSticky } = useScrollVisibility();
  const favoritesSnapshot = useSyncExternalStore(
    subscribeToFavorites,
    getFavoritesSnapshot,
    () => '[]',
  );
  const { items, loading, error, pendingSources, fetchFeeds } = useDiscoverFeedContext();

  const state = useMemo(
    () => ({
      items,
      loading,
      error,
      pendingSources,
      showSticky,
      favoritesSnapshot,
      fetchFeeds,
    }),
    [items, loading, error, pendingSources, showSticky, favoritesSnapshot, fetchFeeds],
  );

  const initialStateRef = useRef(state);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(`discover-feed-state:update:${channelRef.current}`, {
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

  return <SvelteMount component={DiscoverFeedView} props={props} />;
}
