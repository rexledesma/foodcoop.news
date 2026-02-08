'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import type {
  FeedPost,
  GazetteArticle,
  FoodCoopAnnouncement,
  FoodCoopCooksArticle,
  EventbriteEvent,
  ProduceEvent,
} from '@/lib/types';
import { getFeedItemKey, useDiscoverFeedContext, type FeedItem } from '@/lib/discover-feed-context';
import { useScrollVisibility } from '@/components/ScrollVisibilityProvider';

type FilterType =
  | 'latest'
  | 'foodcoop'
  | 'gazette'
  | 'bluesky'
  | 'foodcoopcooks'
  | 'wordsprouts'
  | 'concert-series'
  | 'upcoming'
  | 'produce';

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'foodcoop', label: 'Announcements' },
  { value: 'produce', label: 'Produce' },
  { value: 'gazette', label: "Linewaiters' Gazette" },
  { value: 'bluesky', label: 'Bluesky' },
  { value: 'foodcoopcooks', label: 'Cooking' },
  { value: 'wordsprouts', label: 'Wordsprouts' },
  { value: 'concert-series', label: 'Concerts' },
];

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function parseFavorites(stored: string): Set<string> {
  if (!stored) return new Set();
  try {
    const parsed = JSON.parse(stored) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function subscribeToFavorites(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const handleStorage = (event: StorageEvent) => {
    if (event.key === 'produce-favorites') {
      callback();
    }
  };
  const handleFavorites = () => callback();
  window.addEventListener('storage', handleStorage);
  window.addEventListener('produce-favorites', handleFavorites);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('produce-favorites', handleFavorites);
  };
}

function getFavoritesSnapshot(): string {
  if (typeof window === 'undefined') return '[]';
  return localStorage.getItem('produce-favorites') ?? '[]';
}

function formatEventDateTime(startUtc: string, timezone: string): string {
  const date = new Date(startUtc);
  const now = new Date();

  // Get date strings in the event's timezone for comparison
  const eventDateStr = date.toLocaleDateString('en-US', { timeZone: timezone });
  const todayStr = now.toLocaleDateString('en-US', { timeZone: timezone });

  // Calculate tomorrow's date
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-US', {
    timeZone: timezone,
  });

  const fullDateTime = date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  });

  if (eventDateStr === todayStr) {
    return `Today, ${fullDateTime}`;
  }
  if (eventDateStr === tomorrowStr) {
    return `Tomorrow, ${fullDateTime}`;
  }

  return fullDateTime;
}

function getPostUrl(uri: string): string {
  const parts = uri.replace('at://', '').split('/');
  const handle = parts[0];
  const postId = parts[parts.length - 1];
  return `https://bsky.app/profile/${handle}/post/${postId}`;
}

function GazetteCard({ article }: { article: GazetteArticle; date: Date }) {
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-green-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-green-700"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl dark:bg-amber-900/30">
          📰
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              Linewaiters&apos; Gazette
            </span>
            <span className="shrink-0 text-sm text-zinc-400 dark:text-zinc-500">
              {formatRelativeTime(new Date(article.pubDate))}
            </span>
          </div>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300">{article.title}</p>
          {article.image && (
            <img
              src={article.image}
              alt={`${article.title} cover`}
              className="mt-3 w-full rounded-lg"
            />
          )}
        </div>
      </div>
    </a>
  );
}

function FoodCoopCard({ article }: { article: FoodCoopAnnouncement; date: Date }) {
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-green-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-green-700"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-xl dark:bg-green-900/30">
          📢
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Announcements</span>
            <span className="shrink-0 text-sm text-zinc-400 dark:text-zinc-500">
              {formatRelativeTime(new Date(article.pubDate))}
            </span>
          </div>
          <p className="mt-2 font-medium text-zinc-700 dark:text-zinc-300">{article.title}</p>
          {article.description && (
            <p className="mt-1 line-clamp-3 text-sm text-zinc-500 dark:text-zinc-400">
              {article.description}
            </p>
          )}
          {article.image && (
            <img
              src={article.image}
              alt={`${article.title} cover`}
              className="mt-3 w-full rounded-lg"
            />
          )}
        </div>
      </div>
    </a>
  );
}

function FoodCoopCooksCard({ article }: { article: FoodCoopCooksArticle; date: Date }) {
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-green-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-green-700"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xl dark:bg-orange-900/30">
          🧑‍🍳
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Cooking</span>
            <span className="shrink-0 text-sm text-zinc-400 dark:text-zinc-500">
              {formatRelativeTime(new Date(article.pubDate))}
            </span>
          </div>
          <p className="mt-2 font-medium text-zinc-700 dark:text-zinc-300">{article.title}</p>
          {article.description && (
            <p className="mt-1 line-clamp-3 text-sm text-zinc-500 dark:text-zinc-400">
              {article.description}
            </p>
          )}
          {article.image && (
            <img
              src={article.image}
              alt={`${article.title} cover`}
              className="mt-3 w-full rounded-lg"
            />
          )}
        </div>
      </div>
    </a>
  );
}

function EventbriteEventCard({
  event,
  label,
  emoji,
}: {
  event: EventbriteEvent;
  label: string;
  emoji: string;
}) {
  return (
    <a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-green-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-green-700"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xl dark:bg-rose-900/30">
          {emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{label}</span>
            <span className="shrink-0 text-sm text-zinc-400 dark:text-zinc-500">
              {formatEventDateTime(event.startUtc, event.timezone)}
            </span>
          </div>
          <p className="mt-2 font-medium text-zinc-700 dark:text-zinc-300">{event.title}</p>
          {event.description && (
            <p className="mt-1 line-clamp-3 text-sm text-zinc-500 dark:text-zinc-400">
              {event.description}
            </p>
          )}
          {(event.venueName || event.venueAddress) && (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {[event.venueName, event.venueAddress].filter(Boolean).join(' • ')}
            </p>
          )}
          {event.image && (
            <img
              src={event.image}
              alt={`Poster for ${event.title}`}
              className="mt-3 w-full rounded-lg"
            />
          )}
        </div>
      </div>
    </a>
  );
}

function BlueskyCard({ post }: { post: FeedPost; date: Date }) {
  const isSelfRepost = post.repostedBy && post.repostedBy.handle === post.author.handle;

  return (
    <a
      href={getPostUrl(post.uri)}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-green-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-green-700"
    >
      {post.repostedBy && (
        <div className="mb-3 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>
            {isSelfRepost
              ? 'Reposted their own post'
              : `Reposted by ${post.repostedBy.displayName}`}
          </span>
        </div>
      )}
      {post.parent && (
        <div className="mb-3 border-b border-zinc-200 pb-3 dark:border-zinc-700">
          <div className="flex items-start gap-3">
            {post.parent.author.avatar && (
              <img
                src={post.parent.author.avatar}
                alt={post.parent.author.displayName}
                className="h-10 w-10 shrink-0 rounded-full"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  {post.parent.author.displayName}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {formatRelativeTime(new Date(post.parent.createdAt))}
                </span>
              </div>
              <p className="line-clamp-2 text-sm break-words whitespace-pre-wrap text-zinc-500 dark:text-zinc-500">
                {post.parent.text}
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-start gap-3">
        {post.author.avatar && (
          <img
            src={post.author.avatar}
            alt={post.author.displayName}
            className="h-10 w-10 shrink-0 rounded-full"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <svg
              className="h-4 w-4 shrink-0 text-[#0085ff]"
              viewBox="0 0 600 530"
              fill="currentColor"
              aria-label="Bluesky"
            >
              <title>Bluesky</title>
              <path d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-6.0634-17.664-8.9824-26.262-2.9191 8.5976-6.4685 18.882-8.9824 26.262-13.723 40.255-67.243 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z" />
            </svg>
            <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
              {post.author.displayName}
            </span>
            <span className="shrink-0 text-sm text-zinc-400 dark:text-zinc-500">
              {formatRelativeTime(new Date(post.createdAt))}
            </span>
          </div>
          <p className="mt-2 break-words whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            {post.text}
          </p>
          {post.images && post.images.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {post.images.map((img, idx) => (
                <img
                  key={`${img.fullsize}-${idx}`}
                  src={img.fullsize}
                  alt={img.alt || 'Post media'}
                  className="w-full rounded-lg"
                />
              ))}
            </div>
          )}
          {post.quotedPost && (
            <div className="mt-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                {post.quotedPost.author.avatar && (
                  <img
                    src={post.quotedPost.author.avatar}
                    alt={post.quotedPost.author.displayName}
                    className="h-5 w-5 rounded-full"
                  />
                )}
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {post.quotedPost.author.displayName}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {formatRelativeTime(new Date(post.quotedPost.createdAt))}
                </span>
              </div>
              {post.quotedPost.text && (
                <p className="mt-2 text-sm break-words whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                  {post.quotedPost.text}
                </p>
              )}
              {post.quotedPost.images && post.quotedPost.images.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {post.quotedPost.images.map((img, idx) => (
                    <img
                      key={`${img.fullsize}-${idx}`}
                      src={img.fullsize}
                      alt={img.alt || 'Quoted post media'}
                      className="w-full rounded-lg"
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="mt-3 flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              {post.replyCount}
            </span>
            <span className="flex items-center gap-1">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {post.repostCount}
            </span>
            <span className="flex items-center gap-1">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              {post.likeCount}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}

function ProduceCard({
  update,
  date,
  favorites,
}: {
  update: ProduceEvent;
  date: Date;
  favorites: Set<string>;
}) {
  const formattedDate = formatRelativeTime(date);

  return (
    <Link
      href={`/produce?date=${update.id}`}
      className="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-green-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-green-700"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-xl dark:bg-green-900/30">
          🥬
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Produce</span>
            <span className="shrink-0 text-sm text-zinc-400 dark:text-zinc-500">
              {formattedDate}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {update.newArrivals.length > 0 && (
              <span className="text-green-600 dark:text-green-400">
                {update.newArrivals.length} new arrival{update.newArrivals.length !== 1 ? 's' : ''}
              </span>
            )}
            {update.newArrivals.length > 0 && update.outOfStock.length > 0 && ' · '}
            {update.outOfStock.length > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {update.outOfStock.length} out of stock
              </span>
            )}
          </p>
          {update.newArrivals.length > 0 && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-1.5">
                {update.newArrivals.map((item) => (
                  <span
                    key={item.name}
                    className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  >
                    {favorites.has(item.name) && (
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-amber-100 text-[12px] leading-none text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        ⭐
                      </span>
                    )}
                    <span className={favorites.has(item.name) ? 'font-bold' : ''}>{item.name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {update.outOfStock.length > 0 && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-1.5">
                {update.outOfStock.map((item) => (
                  <span
                    key={item.name}
                    className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  >
                    {favorites.has(item.name) && (
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-amber-100 text-[12px] leading-none text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        ⭐
                      </span>
                    )}
                    <span className={favorites.has(item.name) ? 'font-bold' : ''}>{item.name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function DiscoverFeed() {
  const [filter, setFilter] = useState<FilterType>('latest');
  const { showSticky } = useScrollVisibility();
  const filtersRef = useRef<HTMLDivElement>(null);
  const favoritesSnapshot = useSyncExternalStore(
    subscribeToFavorites,
    getFavoritesSnapshot,
    () => '[]',
  );
  const favorites = useMemo(() => parseFavorites(favoritesSnapshot), [favoritesSnapshot]);
  const { items, loading, error, pendingSources, fetchFeeds } = useDiscoverFeedContext();

  const isEventItem = (item: FeedItem) =>
    item.type === 'foodcoopcooks-events' ||
    item.type === 'wordsprouts-events' ||
    item.type === 'concert-series-events' ||
    item.type === 'gm-events';

  const now = new Date();

  const filteredItems = items.filter((item) => {
    if (filter === 'latest') {
      return !isEventItem(item) || item.date < now;
    }
    if (filter === 'foodcoopcooks') {
      return item.type === 'foodcoopcooks' || item.type === 'foodcoopcooks-events';
    }
    if (filter === 'wordsprouts') {
      return item.type === 'wordsprouts-events';
    }
    if (filter === 'concert-series') {
      return item.type === 'concert-series-events';
    }
    if (filter === 'upcoming') {
      return isEventItem(item) && item.date >= now;
    }
    if (filter === 'foodcoop') {
      return item.type === 'foodcoop' || item.type === 'gm-events';
    }
    if (filter === 'produce') {
      return item.type === 'produce';
    }
    return item.type === filter;
  });

  const displayedItems =
    filter === 'upcoming'
      ? [...filteredItems].sort((a, b) => a.date.getTime() - b.date.getTime())
      : filteredItems;

  useEffect(() => {
    const element = filtersRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    const updateHeight = () => {
      window.dispatchEvent(new CustomEvent('sticky-threshold', { detail: element.offsetHeight }));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const isInitialLoading = loading && items.length === 0;
  const isInitialError = Boolean(error) && items.length === 0;

  return (
    <div>
      <div
        ref={filtersRef}
        className={`sticky top-24 z-20 bg-white transition-opacity duration-300 ease-in-out motion-reduce:transition-none md:top-14 dark:bg-zinc-900 ${
          showSticky ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <h1 className="py-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Discover</h1>
        <div className="pb-4">
          {isInitialLoading ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="feed-shimmer h-8 w-16 rounded-full" />
                <div className="feed-shimmer h-8 w-20 rounded-full" />
              </div>
              <div className="flex gap-2">
                <div className="feed-shimmer h-8 w-28 rounded-full" />
                <div className="feed-shimmer h-8 w-36 rounded-full" />
                <div className="feed-shimmer h-8 w-20 rounded-full" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {FILTER_OPTIONS.filter((option) =>
                  ['latest', 'upcoming'].includes(option.value),
                ).map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => setFilter(option.value)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                      filter === option.value
                        ? 'bg-green-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {FILTER_OPTIONS.filter(
                  (option) => !['latest', 'upcoming'].includes(option.value),
                ).map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => setFilter(option.value)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                      filter === option.value
                        ? 'bg-green-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {!isInitialError && (
                <div className="p-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Showing {displayedItems.length} of {items.length} items
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="transition-opacity duration-300 ease-in-out motion-reduce:transition-none">
        {isInitialLoading ? (
          <div className="grid gap-4">
            <FeedItemSkeleton />
            <FeedItemSkeleton />
            <FeedItemSkeleton />
          </div>
        ) : isInitialError ? (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
            <button
              type="button"
              onClick={fetchFeeds}
              className="ml-2 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-4">
              {displayedItems.map((item) => {
                if (item.type === 'gazette') {
                  return (
                    <div key={getFeedItemKey(item)} className="feed-item-enter">
                      <GazetteCard article={item.data} date={item.date} />
                    </div>
                  );
                }
                if (item.type === 'foodcoop') {
                  return (
                    <div key={getFeedItemKey(item)} className="feed-item-enter">
                      <FoodCoopCard article={item.data} date={item.date} />
                    </div>
                  );
                }
                if (item.type === 'foodcoopcooks') {
                  return (
                    <div key={getFeedItemKey(item)} className="feed-item-enter">
                      <FoodCoopCooksCard article={item.data} date={item.date} />
                    </div>
                  );
                }
                if (item.type === 'foodcoopcooks-events') {
                  return (
                    <div key={getFeedItemKey(item)} className="feed-item-enter">
                      <EventbriteEventCard event={item.data} label="Cooking" emoji="🧑‍🍳" />
                    </div>
                  );
                }
                if (item.type === 'wordsprouts-events') {
                  return (
                    <div key={getFeedItemKey(item)} className="feed-item-enter">
                      <EventbriteEventCard event={item.data} label="Wordsprouts" emoji="🌱" />
                    </div>
                  );
                }
                if (item.type === 'concert-series-events') {
                  return (
                    <div key={getFeedItemKey(item)} className="feed-item-enter">
                      <EventbriteEventCard event={item.data} label="Concerts" emoji="🎶" />
                    </div>
                  );
                }
                if (item.type === 'gm-events') {
                  return (
                    <div key={getFeedItemKey(item)} className="feed-item-enter">
                      <EventbriteEventCard event={item.data} label="General Meeting" emoji="🗳️" />
                    </div>
                  );
                }
                if (item.type === 'produce') {
                  return (
                    <div key={getFeedItemKey(item)} className="feed-item-enter">
                      <ProduceCard update={item.data} date={item.date} favorites={favorites} />
                    </div>
                  );
                }
                return (
                  <div key={getFeedItemKey(item)} className="feed-item-enter">
                    <BlueskyCard post={item.data} date={item.date} />
                  </div>
                );
              })}
              {items.length > 0 && pendingSources > 0 && <FeedItemSkeleton />}
            </div>

            {filteredItems.length === 0 && pendingSources === 0 && (
              <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">No items found.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FeedItemSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-start gap-3">
        <div className="feed-shimmer h-10 w-10 rounded-full" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="feed-shimmer h-4 w-40 rounded-full" />
          <div className="space-y-2">
            <div className="feed-shimmer h-3 w-full rounded-full" />
            <div className="feed-shimmer h-3 w-5/6 rounded-full" />
            <div className="feed-shimmer h-3 w-2/3 rounded-full" />
          </div>
        </div>
      </div>
      <div className="feed-shimmer mt-4 h-32 rounded-lg" />
    </div>
  );
}
