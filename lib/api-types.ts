export interface UserDto {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface SubscriptionState {
  plan: "basic" | "business" | "enterprise" | string;
  limitPerPlatform: number | null;
  status: string;
  currentPeriodEnd: Date | string | null;
  cancelAtPeriodEnd: boolean;
}

export interface SocialAccount {
  id: string;
  userId: string;
  platform: string;
  platformUserId: string;
  platformUsername: string;
  accessToken?: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | string | null;
  oauth1AccessToken?: string | null;
  accessTokenSecret?: string | null;
  profileImageUrl?: string | null;
  followerCount?: number | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PostTarget {
  id: string;
  postId: string;
  socialAccountId: string;
  status: string;
  platformPostId?: string | null;
  publishedAt?: Date | string | null;
  errorMessage?: string | null;
  account?: SocialAccount | null;
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  mediaUrls?: string[] | null;
  scheduledFor?: Date | string | null;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  targets?: PostTarget[];
}

export interface PostWithTargets extends Post {
  targets: PostTarget[];
}

export interface SessionResponse {
  user: UserDto | null;
}

export interface DashboardSummary {
  user: UserDto;
  accounts: SocialAccount[];
  posts: PostWithTargets[];
  stats: {
    connectedAccounts: number;
    scheduledPosts: number;
    publishedPosts: number;
  };
}
