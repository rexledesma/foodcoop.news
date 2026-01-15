"use client";

import { useState, useEffect } from "react";
import type { FeedPost } from "@/lib/types";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
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

export function FeedList() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/feed");
      const data = await response.json();

      if (response.ok) {
        setPosts(data.posts);
        setLastUpdated(data.lastUpdated);
      } else {
        setError(data.error || "Failed to load feed");
      }
    } catch {
      setError("Failed to load feed data");
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
          onClick={fetchFeed}
          className="ml-2 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">{posts.length} posts</span>
        <button
          onClick={fetchFeed}
          className="text-xs text-green-600 hover:text-green-700 dark:text-green-400"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4">
        {posts.map((post) => (
          <a
            key={post.id}
            href={getPostUrl(post.uri)}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 hover:border-green-300 dark:hover:border-green-700 transition-colors"
          >
            <div className="flex items-start gap-3">
              {post.author.avatar && (
                <img
                  src={post.author.avatar}
                  alt={post.author.displayName}
                  className="w-10 h-10 rounded-full shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {post.author.displayName}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                    @{post.author.handle}
                  </span>
                  <span className="text-sm text-zinc-400 dark:text-zinc-500 shrink-0">
                    · {formatRelativeTime(post.createdAt)}
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
                        src={img.thumb}
                        alt={img.alt || "Post image"}
                        className="rounded-lg w-full object-cover max-h-48"
                      />
                    ))}
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
        ))}
      </div>

      {posts.length === 0 && (
        <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
          No posts found.
        </p>
      )}

      {lastUpdated && (
        <p className="text-center text-xs text-zinc-400 pt-4">
          Last updated: {new Date(lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
}
