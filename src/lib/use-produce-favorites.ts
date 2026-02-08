'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useSession } from '@/lib/auth-client';

const STORAGE_KEY = 'produce-favorites';

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

  // localStorage fallback for unauthenticated users
  const [localFavorites, setLocalFavorites] = useState<Set<string>>(readLocalFavorites);

  const toggleFavorite = useCallback(
    (name: string) => {
      if (isAuthenticated) {
        toggleMutation({ itemName: name });
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
    return {
      favorites: new Set(serverFavorites ?? []),
      toggleFavorite,
      isLoading: serverFavorites === undefined,
    };
  }

  return {
    favorites: localFavorites,
    toggleFavorite,
    isLoading: false,
  };
}
