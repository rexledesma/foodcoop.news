export interface Member {
  id: string;
  name: string;
  status: "active" | "alert" | "suspended" | "unknown";
  memberNumber: string;
  barcodeValue?: string;
  householdId?: string;
}

export interface Produce {
  id: string;
  name: string;
  price: string;
  priceUnit: "per pound" | "each" | "unknown";
  organic: boolean;
  growingPractice: string;
  origin: string;
}

export interface Shift {
  id: string;
  startTime: string;
  endTime: string;
  shiftName: string;
}

export interface AuthSession {
  authenticated: boolean;
  member?: Member;
  cookies?: string;
  expiresAt?: number;
}

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
}

export interface GazetteArticle {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  image?: string;
}
