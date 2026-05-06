import { cookies } from "next/headers";

import type {
  DashboardSummary,
  PostWithTargets,
  SocialAccount,
  SubscriptionState,
  UserDto,
} from "@/lib/api/types";
import { apiPaths } from "@/lib/api/endpoints";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

export class BackendUnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "BackendUnauthorizedError";
  }
}

export const ApiUnauthorizedError = BackendUnauthorizedError;

export function isApiUnauthorizedError(error: unknown): boolean {
  return error instanceof BackendUnauthorizedError;
}

function apiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
    DEFAULT_API_BASE_URL
  );
}

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  return store
    .getAll()
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");
}

async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const cookie = await cookieHeader();
  if (cookie) headers.set("Cookie", cookie);

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (response.status === 401) {
    throw new BackendUnauthorizedError();
  }
  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function normalizeAccount(account: SocialAccount): SocialAccount {
  return {
    ...account,
    tokenExpiresAt: toDate(account.tokenExpiresAt),
    createdAt: toDate(account.createdAt) ?? new Date(0),
    updatedAt: toDate(account.updatedAt) ?? new Date(0),
  };
}

function normalizePost(post: PostWithTargets): PostWithTargets {
  return {
    ...post,
    scheduledFor: toDate(post.scheduledFor),
    createdAt: toDate(post.createdAt) ?? new Date(0),
    updatedAt: toDate(post.updatedAt) ?? new Date(0),
    targets: post.targets.map((target) => ({
      ...target,
      publishedAt: toDate(target.publishedAt),
      account: target.account ? normalizeAccount(target.account) : null,
    })),
  };
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const summary = await backendFetch<DashboardSummary>(apiPaths.dashboard.summary);
  return {
    ...summary,
    accounts: summary.accounts.map(normalizeAccount),
    posts: summary.posts.map(normalizePost),
  };
}

export async function getBackendSession(): Promise<{ user: UserDto | null }> {
  return backendFetch<{ user: UserDto | null }>(apiPaths.auth.session);
}

export async function getDashboardAccounts(): Promise<SocialAccount[]> {
  const accounts = await backendFetch<SocialAccount[]>(apiPaths.dashboard.accounts);
  return accounts.map(normalizeAccount);
}

export async function getSubscriptionState(): Promise<SubscriptionState | null> {
  const subscriptionState = await backendFetch<SubscriptionState | null>(
    apiPaths.dashboard.subscription
  );
  return subscriptionState
    ? {
        ...subscriptionState,
        currentPeriodEnd: toDate(subscriptionState.currentPeriodEnd),
      }
    : null;
}

export async function getDashboardPosts(): Promise<{
  posts: PostWithTargets[];
  accounts: SocialAccount[];
}> {
  return getPostsPageData();
}

export async function getPostsPageData(): Promise<{
  posts: PostWithTargets[];
  accounts: SocialAccount[];
}> {
  const [posts, accounts] = await Promise.all([
    backendFetch<PostWithTargets[]>(apiPaths.dashboard.posts),
    backendFetch<SocialAccount[]>(apiPaths.dashboard.accounts),
  ]);
  return {
    posts: posts.map(normalizePost),
    accounts: accounts.map(normalizeAccount),
  };
}
