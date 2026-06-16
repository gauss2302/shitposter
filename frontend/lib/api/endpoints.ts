const API_V1 = "/api/v1";

export const apiEndpoints = {
  auth: {
    session: `${API_V1}/auth/session`,
    signIn: `${API_V1}/auth/sign-in`,
    signOut: `${API_V1}/auth/sign-out`,
    signUp: `${API_V1}/auth/sign-up`,
    socialStart(provider: string, callbackQuery = "") {
      return `${API_V1}/auth/${provider}/start${callbackQuery}`;
    },
    oauthStart(provider: string, callbackQuery = "") {
      return `${API_V1}/auth/${provider}/start${callbackQuery}`;
    },
  },
  dashboard: {
    accounts: `${API_V1}/dashboard/accounts`,
    posts: `${API_V1}/dashboard/posts`,
    subscription: `${API_V1}/dashboard/subscription`,
    summary: `${API_V1}/dashboard/summary`,
    agentReadiness: `${API_V1}/dashboard/agent-readiness`,
  },
  posts: {
    collection: `${API_V1}/posts`,
    create: `${API_V1}/posts`,
  },
  apiKeys: {
    collection: `${API_V1}/api-keys`,
    item(apiKeyId: string) {
      return `${API_V1}/api-keys/${apiKeyId}`;
    },
  },
  ai: {
    providers: `${API_V1}/ai/providers`,
    provider(providerId: string) {
      return `${API_V1}/ai/providers/${providerId}`;
    },
    generate: `${API_V1}/ai/generate`,
  },
  social: {
    connect(platform: string) {
      return `${API_V1}/social/connect/${platform}`;
    },
    account(accountId: string) {
      return `${API_V1}/social/accounts/${accountId}`;
    },
  },
  analytics: {
    twitter(accountId: string, tweetLimit: number) {
      return `${API_V1}/analytics/twitter/${accountId}?limit=${tweetLimit}`;
    },
  },
  billing: {
    checkout: `${API_V1}/billing/checkout`,
    portal: `${API_V1}/billing/portal`,
  },
  media: {
    upload: `${API_V1}/media/upload`,
  },
  videos: {
    generate: `${API_V1}/videos/generate`,
    jobs: `${API_V1}/videos/jobs`,
    job(jobId: string) {
      return `${API_V1}/videos/jobs/${jobId}`;
    },
  },
  recipes: {
    collection: `${API_V1}/recipes`,
    item(recipeId: string) {
      return `${API_V1}/recipes/${recipeId}`;
    },
  },
} as const;

export const apiPaths = apiEndpoints;
