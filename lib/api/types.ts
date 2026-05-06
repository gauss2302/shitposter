export interface UserDto {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface AuthSession {
  user: UserDto | null;
}

export type AuthResult = {
  data?: AuthSession;
  error?: { message: string } | null;
};

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
  tokenExpiresAt?: Date | null;
  oauth1AccessToken?: string | null;
  accessTokenSecret?: string | null;
  profileImageUrl?: string | null;
  followerCount: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostTarget {
  id: string;
  postId: string;
  socialAccountId: string;
  status: string;
  platformPostId?: string | null;
  publishedAt?: Date | null;
  errorMessage?: string | null;
  account: SocialAccount | null;
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  mediaUrls?: string[] | null;
  scheduledFor?: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
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

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  isActive: boolean;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedApiKey {
  apiKey: ApiKey;
  token: string;
}

export interface AiProviderCredential {
  id: string;
  provider: string;
  displayName: string;
  baseUrl?: string | null;
  defaultModel: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiProviderCredentialRequest {
  provider: string;
  displayName: string;
  apiKey: string;
  baseUrl?: string | null;
  defaultModel: string;
}

export interface AiGeneratedCandidate {
  content: string;
  platformFit: Record<string, boolean>;
  charCount: number;
  warnings: string[];
}

export interface AiGenerateResponse {
  candidates: AiGeneratedCandidate[];
  provider: string;
  model: string;
}
