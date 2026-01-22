import { NextResponse } from "next/server";
import type { FeedPost } from "@/lib/types";

const BLUESKY_HANDLE = "foodcoop.bsky.social";
const BLUESKY_API = "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed";

// Cache feed data for 5 minutes
let cachedFeed: FeedPost[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

interface BlueskyImage {
  thumb: string;
  fullsize: string;
  alt: string;
}

interface BlueskyEmbed {
  $type: string;
  images?: BlueskyImage[];
  media?: {
    $type: string;
    images?: BlueskyImage[];
  };
}

function extractImages(embed?: BlueskyEmbed): BlueskyImage[] | undefined {
  if (!embed) return undefined;

  // Direct images embed
  if (embed.$type === "app.bsky.embed.images#view" && embed.images) {
    return embed.images;
  }

  // Record with media (quote post with images)
  if (
    embed.$type === "app.bsky.embed.recordWithMedia#view" &&
    embed.media?.images
  ) {
    return embed.media.images;
  }

  return undefined;
}

interface BlueskyPost {
  uri: string;
  cid: string;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: {
    text: string;
    createdAt: string;
  };
  embed?: BlueskyEmbed;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
}

interface BlueskyFeedItem {
  post: BlueskyPost;
  reply?: {
    parent: BlueskyPost;
    root: BlueskyPost;
  };
}

interface BlueskyResponse {
  feed: BlueskyFeedItem[];
}

async function fetchBlueskyFeed(): Promise<FeedPost[]> {
  const url = `${BLUESKY_API}?actor=${BLUESKY_HANDLE}&limit=30`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Bluesky API error: ${response.status}`);
  }

  const data: BlueskyResponse = await response.json();

  return data.feed.map((item) => {
    const post = item.post;
    const images = extractImages(post.embed);

    const parent = item.reply?.parent
      ? {
          uri: item.reply.parent.uri,
          text: item.reply.parent.record.text,
          createdAt: item.reply.parent.record.createdAt,
          author: {
            handle: item.reply.parent.author.handle,
            displayName:
              item.reply.parent.author.displayName ||
              item.reply.parent.author.handle,
            avatar: item.reply.parent.author.avatar,
          },
        }
      : undefined;

    return {
      id: post.cid,
      uri: post.uri,
      text: post.record.text,
      createdAt: post.record.createdAt,
      author: {
        handle: post.author.handle,
        displayName: post.author.displayName || post.author.handle,
        avatar: post.author.avatar,
      },
      images,
      likeCount: post.likeCount || 0,
      repostCount: post.repostCount || 0,
      replyCount: post.replyCount || 0,
      parent,
    };
  });
}

export async function GET() {
  try {
    const now = Date.now();
    if (!cachedFeed || now - cacheTime > CACHE_DURATION) {
      cachedFeed = await fetchBlueskyFeed();
      cacheTime = now;
    }

    return NextResponse.json({
      posts: cachedFeed,
      total: cachedFeed.length,
      lastUpdated: new Date(cacheTime).toISOString(),
    });
  } catch (error) {
    console.error("Feed API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed data" },
      { status: 500 }
    );
  }
}
