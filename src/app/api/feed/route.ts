import { NextResponse } from 'next/server';
import type { FeedPost } from '@/lib/types';

const BLUESKY_HANDLE = 'foodcoop.bsky.social';
const BLUESKY_API = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed';

// Cache feed data for 5 minutes
let cachedFeed: FeedPost[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

interface BlueskyImage {
  thumb: string;
  fullsize: string;
  alt: string;
}

interface BlueskyEmbedRecord {
  $type: string;
  uri: string;
  cid: string;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  value: {
    text: string;
    createdAt: string;
  };
  embeds?: BlueskyEmbed[];
}

interface BlueskyEmbed {
  $type: string;
  images?: BlueskyImage[];
  media?: {
    $type: string;
    images?: BlueskyImage[];
  };
  // For app.bsky.embed.record#view, record is BlueskyEmbedRecord directly
  // For app.bsky.embed.recordWithMedia#view, record is { record: BlueskyEmbedRecord }
  record?: BlueskyEmbedRecord | { record: BlueskyEmbedRecord };
}

function extractImages(embed?: BlueskyEmbed): BlueskyImage[] | undefined {
  if (!embed) return undefined;

  // Direct images embed
  if (embed.$type === 'app.bsky.embed.images#view' && embed.images) {
    return embed.images;
  }

  // Record with media (quote post with images)
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view' && embed.media?.images) {
    return embed.media.images;
  }

  return undefined;
}

interface QuotedPost {
  uri: string;
  text: string;
  createdAt: string;
  author: {
    handle: string;
    displayName: string;
    avatar?: string;
  };
  images?: BlueskyImage[];
}

function extractQuotedPost(embed?: BlueskyEmbed): QuotedPost | undefined {
  if (!embed) return undefined;

  // Direct record embed (quote post without media)
  if (embed.$type === 'app.bsky.embed.record#view' && embed.record) {
    // For this type, record is BlueskyEmbedRecord directly
    const record = embed.record as BlueskyEmbedRecord;
    // Only handle view records, not blocked/notFound/etc
    if (record.$type !== 'app.bsky.embed.record#viewRecord') {
      return undefined;
    }
    // Extract images from the quoted post's embeds if any
    const quotedImages = record.embeds?.[0] ? extractImages(record.embeds[0]) : undefined;

    return {
      uri: record.uri,
      text: record.value.text,
      createdAt: record.value.createdAt,
      author: {
        handle: record.author.handle,
        displayName: record.author.displayName || record.author.handle,
        avatar: record.author.avatar,
      },
      images: quotedImages,
    };
  }

  // Record with media (quote post with images on the quoting post)
  // For this type, the actual record is nested: embed.record.record
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view' && embed.record) {
    const wrapper = embed.record as { record: BlueskyEmbedRecord };
    const record = wrapper.record;
    if (!record || record.$type !== 'app.bsky.embed.record#viewRecord') {
      return undefined;
    }
    const quotedImages = record.embeds?.[0] ? extractImages(record.embeds[0]) : undefined;

    return {
      uri: record.uri,
      text: record.value.text,
      createdAt: record.value.createdAt,
      author: {
        handle: record.author.handle,
        displayName: record.author.displayName || record.author.handle,
        avatar: record.author.avatar,
      },
      images: quotedImages,
    };
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

interface BlueskyRepostReason {
  $type: 'app.bsky.feed.defs#reasonRepost';
  by: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  indexedAt: string;
}

interface BlueskyFeedItem {
  post: BlueskyPost;
  reply?: {
    parent: BlueskyPost;
    root: BlueskyPost;
  };
  reason?: BlueskyRepostReason;
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
    const quotedPost = extractQuotedPost(post.embed);

    const parent = item.reply?.parent
      ? {
          uri: item.reply.parent.uri,
          text: item.reply.parent.record.text,
          createdAt: item.reply.parent.record.createdAt,
          author: {
            handle: item.reply.parent.author.handle,
            displayName: item.reply.parent.author.displayName || item.reply.parent.author.handle,
            avatar: item.reply.parent.author.avatar,
          },
        }
      : undefined;

    const repostedBy =
      item.reason?.$type === 'app.bsky.feed.defs#reasonRepost'
        ? {
            handle: item.reason.by.handle,
            displayName: item.reason.by.displayName || item.reason.by.handle,
            avatar: item.reason.by.avatar,
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
      quotedPost,
      repostedBy,
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
    console.error('Feed API error:', error);
    return NextResponse.json({ error: 'Failed to fetch feed data' }, { status: 500 });
  }
}
