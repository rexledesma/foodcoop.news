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

export interface FoodcoopEvent {
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

export interface ProduceEventItem {
  name: string;
}

export interface ProduceEvent {
  id: string;
  date: string;
  newArrivals: ProduceEventItem[];
  outOfStock: ProduceEventItem[];
}

export type ProduceUnit = 'pound' | 'each' | 'bunch';

export interface ProduceItem {
  id: string; // e.g., "2025-01-29-apple-honeycrisp"
  date: string; // ISO date, e.g., "2025-01-29"
  name: string; // Original name from HTML
  price: number; // e.g., 2.40
  unit: ProduceUnit;
  isOrganic: boolean;
  isIpm: boolean; // Integrated Pest Management
  isWaxed: boolean;
  isLocal: boolean; // Within 500 miles
  isHydroponic: boolean;
  origin: string; // Full origin text
}

export interface ParsedProducePage {
  date: string;
  items: ProduceItem[];
}
