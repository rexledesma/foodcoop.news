"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect } from "react";
import type { FeedPost, GazetteArticle, FoodCoopAnnouncement } from "@/lib/types";

type FeedItem =
  | { type: "gazette"; data: GazetteArticle; date: Date }
  | { type: "bluesky"; data: FeedPost; date: Date }
  | { type: "foodcoop"; data: FoodCoopAnnouncement; date: Date };

type FilterType = "all" | "foodcoop" | "gazette" | "bluesky";

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "foodcoop", label: "Coop Announcements" },
  { value: "gazette", label: "Linewaiters' Gazette" },
  { value: "bluesky", label: "Bluesky" },
];

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getPostUrl(uri: string): string {
  const parts = uri.replace("at://", "").split("/");
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
      className="block bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 hover:border-green-300 dark:hover:border-green-700 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full shrink-0 bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-amber-700 dark:text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              Linewaiters&apos; Gazette
            </span>
            <span className="text-sm text-zinc-400 dark:text-zinc-500 shrink-0">
              {formatRelativeTime(new Date(article.pubDate))}
            </span>
          </div>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300">
            {article.title}
          </p>
          {article.image && (
            <img
              src={article.image}
              alt=""
              className="mt-3 rounded-lg w-full"
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
      className="block bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 hover:border-green-300 dark:hover:border-green-700 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full shrink-0 bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-green-700 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              Park Slope Food Coop
            </span>
            <span className="text-sm text-zinc-400 dark:text-zinc-500 shrink-0">
              {formatRelativeTime(new Date(article.pubDate))}
            </span>
          </div>
          <p className="mt-2 font-medium text-zinc-700 dark:text-zinc-300">
            {article.title}
          </p>
          {article.description && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-3">
              {article.description}
            </p>
          )}
          {article.image && (
            <img
              src={article.image}
              alt=""
              className="mt-3 rounded-lg w-full"
            />
          )}
        </div>
      </div>
    </a>
  );
}

function BlueskyCard({ post }: { post: FeedPost; date: Date }) {
  const isSelfRepost =
    post.repostedBy && post.repostedBy.handle === post.author.handle;

  return (
    <a
      href={getPostUrl(post.uri)}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 hover:border-green-300 dark:hover:border-green-700 transition-colors"
    >
      {post.repostedBy && (
        <div className="flex items-center gap-2 mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
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
              ? "Reposted their own post"
              : `Reposted by ${post.repostedBy.displayName}`}
          </span>
        </div>
      )}
      {post.parent && (
        <div className="mb-3 pb-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-start gap-3">
            {post.parent.author.avatar && (
              <img
                src={post.parent.author.avatar}
                alt={post.parent.author.displayName}
                className="w-10 h-10 rounded-full shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  {post.parent.author.displayName}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {formatRelativeTime(new Date(post.parent.createdAt))}
                </span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-500 line-clamp-2 whitespace-pre-wrap break-words">
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
            className="w-10 h-10 rounded-full shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <svg
              className="w-4 h-4 text-[#0085ff] shrink-0"
              viewBox="0 0 600 530"
              fill="currentColor"
              aria-label="Bluesky"
            >
              <path d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-6.0634-17.664-8.9824-26.262-2.9191 8.5976-6.4685 18.882-8.9824 26.262-13.723 40.255-67.243 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z" />
            </svg>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {post.author.displayName}
            </span>
            <span className="text-sm text-zinc-400 dark:text-zinc-500 shrink-0">
              {formatRelativeTime(new Date(post.createdAt))}
            </span>
          </div>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
            {post.text}
          </p>
          {post.images && post.images.length > 0 && (
            <div className="mt-3 grid gap-2 grid-cols-2">
              {post.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img.fullsize}
                  alt={img.alt || "Post image"}
                  className="rounded-lg w-full"
                />
              ))}
            </div>
          )}
          {post.quotedPost && (
            <div className="mt-3 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
              <div className="flex items-center gap-2">
                {post.quotedPost.author.avatar && (
                  <img
                    src={post.quotedPost.author.avatar}
                    alt={post.quotedPost.author.displayName}
                    className="w-5 h-5 rounded-full"
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
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-words">
                  {post.quotedPost.text}
                </p>
              )}
              {post.quotedPost.images && post.quotedPost.images.length > 0 && (
                <div className="mt-2 grid gap-2 grid-cols-2">
                  {post.quotedPost.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img.fullsize}
                      alt={img.alt || "Quoted post image"}
                      className="rounded-lg w-full"
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="mt-3 flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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

export function DiscoverFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredItems = items.filter(
    (item) => filter === "all" || item.type === filter
  );

  useEffect(() => {
    fetchFeeds();
  }, []);

  const fetchFeeds = async () => {
    try {
      setLoading(true);
      setError("");

      const [gazetteRes, blueskyRes, foodcoopRes] = await Promise.all([
        fetch("/api/gazette"),
        fetch("/api/feed"),
        fetch("/api/foodcoop"),
      ]);

      const combinedItems: FeedItem[] = [];

      if (gazetteRes.ok) {
        const gazetteData = await gazetteRes.json();
        for (const article of gazetteData.articles as GazetteArticle[]) {
          combinedItems.push({
            type: "gazette",
            data: article,
            date: new Date(article.pubDate),
          });
        }
      }

      if (blueskyRes.ok) {
        const blueskyData = await blueskyRes.json();
        for (const post of blueskyData.posts as FeedPost[]) {
          // Skip reposts in the UI (they're still available in the API)
          if (post.repostedBy) continue;
          combinedItems.push({
            type: "bluesky",
            data: post,
            date: new Date(post.createdAt),
          });
        }
      }

      if (foodcoopRes.ok) {
        const foodcoopData = await foodcoopRes.json();
        for (const announcement of foodcoopData.articles as FoodCoopAnnouncement[]) {
          combinedItems.push({
            type: "foodcoop",
            data: announcement,
            date: new Date(announcement.pubDate),
          });
        }
      }

      // Sort by date, newest first
      combinedItems.sort((a, b) => b.date.getTime() - a.date.getTime());

      setItems(combinedItems);
    } catch {
      setError("Failed to load feed");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
        {error}
        <button
          onClick={fetchFeeds}
          className="ml-2 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === option.value
                ? "bg-green-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {filteredItems.map((item) => {
          if (item.type === "gazette") {
            return (
              <GazetteCard
                key={`gazette-${item.data.id}`}
                article={item.data}
                date={item.date}
              />
            );
          }
          if (item.type === "foodcoop") {
            return (
              <FoodCoopCard
                key={`foodcoop-${item.data.id}`}
                article={item.data}
                date={item.date}
              />
            );
          }
          return (
            <BlueskyCard
              key={
                item.data.repostedBy
                  ? `bluesky-${item.data.id}-repost-${item.data.repostedBy.handle}`
                  : `bluesky-${item.data.id}`
              }
              post={item.data}
              date={item.date}
            />
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
          No items found.
        </p>
      )}
    </div>
  );
}
