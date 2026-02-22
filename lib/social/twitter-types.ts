/**
 * Raw response types for Twitter API v2 (as returned by the API).
 * Used for type-safe parsing without `any`.
 */

// ----- User (v2) -----

export interface TwitterApiV2PublicMetricsRaw {
  followers_count?: number;
  following_count?: number;
  tweet_count?: number;
  listed_count?: number;
}

export interface TwitterApiV2UserRaw {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
  public_metrics?: TwitterApiV2PublicMetricsRaw;
}

// ----- Tweet (v2) -----

export interface TwitterApiV2TweetPublicMetricsRaw {
  retweet_count?: number;
  reply_count?: number;
  like_count?: number;
  quote_count?: number;
  bookmark_count?: number;
  impression_count?: number;
}

export interface TwitterApiV2TweetRaw {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: TwitterApiV2TweetPublicMetricsRaw;
}

// ----- API response wrappers -----

export interface TwitterApiV2UserResponse {
  data: TwitterApiV2UserRaw;
}

export interface TwitterApiV2TweetsResponse {
  data?: TwitterApiV2TweetRaw[] | null;
}

export interface TwitterApiV2SingleTweetResponse {
  data: TwitterApiV2TweetRaw;
}

export interface TwitterApiV2PostTweetResponse {
  data: { id: string };
}

export interface TwitterApiOAuth2TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// ----- Rate limit -----

export interface TwitterRateLimit {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
}

// ----- Errors -----

export interface TwitterApiErrorItem {
  message: string;
  code?: number;
}

export interface TwitterApiErrorRaw {
  detail?: string;
  title?: string;
  errors?: TwitterApiErrorItem[];
}

// ----- Media upload (v1.1) -----

export interface TwitterMediaInitResponse {
  media_id_string: string;
}

export interface TwitterMediaProcessingInfo {
  state: string;
  check_after_secs?: number;
  error?: { message: string };
}

export interface TwitterMediaFinalizeResponse {
  processing_info?: TwitterMediaProcessingInfo;
}

export interface TwitterMediaStatusResponse {
  processing_info?: TwitterMediaProcessingInfo;
}
