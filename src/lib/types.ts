export interface FeedPostAuthor {
  handle: string;
  displayName: string;
  avatar?: string;
}

export interface FeedPostParent {
  uri: string;
  text: string;
  createdAt: string;
  author: FeedPostAuthor;
}

export interface FeedPostQuoted {
  uri: string;
  text: string;
  createdAt: string;
  author: FeedPostAuthor;
  images?: {
    thumb: string;
    fullsize: string;
    alt: string;
  }[];
}

export interface FeedPostRepostedBy {
  handle: string;
  displayName: string;
  avatar?: string;
}

export interface FeedPost {
  id: string;
  uri: string;
  text: string;
  createdAt: string;
  author: FeedPostAuthor;
  images?: {
    thumb: string;
    fullsize: string;
    alt: string;
  }[];
  likeCount: number;
  repostCount: number;
  replyCount: number;
  parent?: FeedPostParent;
  quotedPost?: FeedPostQuoted;
  repostedBy?: FeedPostRepostedBy;
}

export interface GazetteArticle {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  image?: string;
}

export interface FoodCoopAnnouncement {
  id: string;
  title: string;
  description?: string;
  link: string;
  pubDate: string;
  image?: string;
}

export interface FoodCoopCooksArticle {
  id: string;
  title: string;
  description?: string;
  link: string;
  pubDate: string;
  image?: string;
}

export interface EventbriteEvent {
  id: string;
  title: string;
  description?: string;
  url: string;
  startUtc: string;
  timezone: string;
  venueName?: string;
  venueAddress?: string;
  image?: string;
}

export type FoodCoopCooksEvent = EventbriteEvent;
