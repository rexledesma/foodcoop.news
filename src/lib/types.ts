export interface Member {
  id: string;
  name: string;
  status: "active" | "alert" | "suspended" | "unknown";
  memberNumber: string;
  barcodeValue?: string;
  householdId?: string;
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
}

export interface GazetteArticle {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  image?: string;
}
