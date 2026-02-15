'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useSession } from '@/lib/auth-client';

const STORAGE_KEY = 'produce-favorites';
const CACHE_KEY = 'produce-favorites-cache';

function readLocalFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Set();
    return new Set(JSON.parse(stored) as string[]);
  } catch {
    return new Set();
  }
}

function writeLocalFavorites(favorites: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(favorites)));
  window.dispatchEvent(new Event(STORAGE_KEY));
}

function readFavoritesCache(): Set<string> | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return null;
    return new Set(JSON.parse(stored) as string[]);
  } catch {
    return null;
  }
}

function writeFavoritesCache(favorites: string[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(favorites));
  } catch {
    // Silently ignore quota errors
  }
}

function clearFavoritesCache() {
  localStorage.removeItem(CACHE_KEY);
}

export function useProduceFavorites(): {
  favorites: Set<string>;
  toggleFavorite: (name: string) => void;
  isLoading: boolean;
} {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  // Convex queries/mutations — skip when not authenticated
  const serverFavorites = useQuery(
    api.produceFavorites.getUserFavorites,
    isAuthenticated ? {} : 'skip',
  );
  const toggleMutation = useMutation(api.produceFavorites.toggleFavorite).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.produceFavorites.getUserFavorites, {});
      if (current === undefined) return;
      const updated = current.includes(args.itemName)
        ? current.filter((name) => name !== args.itemName)
        : [...current, args.itemName];
      localStore.setQuery(api.produceFavorites.getUserFavorites, {}, updated);
    },
  );

  // SWR cache for authenticated users — read synchronously on mount
  const [cachedFavorites] = useState(() => readFavoritesCache());

  // localStorage fallback for unauthenticated users
  const [localFavorites, setLocalFavorites] = useState<Set<string>>(readLocalFavorites);

  // Write cache when server data arrives or changes
  useEffect(() => {
    if (serverFavorites !== undefined) {
      writeFavoritesCache(serverFavorites);
    }
  }, [serverFavorites]);

  // Clear cache on logout
  useEffect(() => {
    if (!isAuthenticated) {
      clearFavoritesCache();
    }
  }, [isAuthenticated]);

  const toggleFavorite = useCallback(
    (name: string) => {
      if (isAuthenticated) {
        void toggleMutation({ itemName: name }).catch((error) => {
          console.error('Failed to toggle produce favorite:', error);
        });
        // Optimistically update the localStorage cache
        const current = readFavoritesCache();
        if (current) {
          const next = new Set(current);
          if (next.has(name)) {
            next.delete(name);
          } else {
            next.add(name);
          }
          writeFavoritesCache(Array.from(next));
        }
      } else {
        setLocalFavorites((prev) => {
          const next = new Set(prev);
          if (next.has(name)) {
            next.delete(name);
          } else {
            next.add(name);
          }
          writeLocalFavorites(next);
          return next;
        });
      }
    },
    [isAuthenticated, toggleMutation],
  );

  if (isAuthenticated) {
    const favorites = serverFavorites
      ? new Set(serverFavorites)
      : (cachedFavorites ?? new Set<string>());
    return {
      favorites,
      toggleFavorite,
      isLoading: serverFavorites === undefined && cachedFavorites === null,
    };
  }

  return {
    favorites: localFavorites,
    toggleFavorite,
    isLoading: false,
  };
}
