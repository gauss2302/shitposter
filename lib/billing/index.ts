import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscription, socialAccount } from "@/lib/db/schema";
import type { PlanSlug } from "./limits";
import {
  getAccountLimitForPlan,
  isPlanActive,
  PLAN_ACCOUNT_LIMITS,
} from "./limits";

export type { PlanSlug } from "./limits";
export { PLAN_ACCOUNT_LIMITS, getAccountLimitForPlan, isPlanActive };

export interface SubscriptionState {
  plan: PlanSlug;
  limitPerPlatform: number | null;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Get the current subscription row for a user (if any).
 */
export async function getSubscription(userId: string) {
  const row = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
  });
  return row ?? null;
}

/**
 * Get current plan and limit for the user. Returns null if no active subscription.
 */
export async function getSubscriptionState(
  userId: string
): Promise<SubscriptionState | null> {
  const row = await getSubscription(userId);
  if (!row || !isPlanActive(row.status)) return null;
  const plan = row.plan as PlanSlug;
  if (!(plan in PLAN_ACCOUNT_LIMITS)) return null;
  const limitPerPlatform = getAccountLimitForPlan(plan);
  return {
    plan,
    limitPerPlatform,
    status: row.status,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  };
}

/**
 * Count of connected social accounts for the user on the given platform
 * (all rows, not only isActive).
 */
export async function countAccountsByPlatform(
  userId: string,
  platform: string
): Promise<number> {
  const rows = await db
    .select()
    .from(socialAccount)
    .where(
      and(eq(socialAccount.userId, userId), eq(socialAccount.platform, platform))
    );
  return rows.length;
}

/**
 * Whether the user is allowed to connect one more account on the given platform.
 * Requires an active subscription; enforces per-platform limit.
 */
export async function canConnectPlatformAccount(
  userId: string,
  platform: string
): Promise<boolean> {
  const state = await getSubscriptionState(userId);
  if (!state) return false;
  if (state.limitPerPlatform === null) return true; // unlimited
  const current = await countAccountsByPlatform(userId, platform);
  return current < state.limitPerPlatform;
}

export interface SyncSubscriptionInput {
  userId: string;
  polarCustomerId: string;
  polarSubscriptionId: string | null;
  plan: PlanSlug;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  metadata?: string;
}

/**
 * Upsert subscription row from webhook payload. Caller must resolve userId (e.g. from customer.externalId).
 */
export async function syncSubscription(input: SyncSubscriptionInput) {
  const { nanoid } = await import("nanoid");
  const now = new Date();
  const existing = await getSubscription(input.userId);
  const id = existing?.id ?? nanoid();
  const row = {
    id,
    userId: input.userId,
    polarCustomerId: input.polarCustomerId,
    polarSubscriptionId: input.polarSubscriptionId,
    plan: input.plan,
    status: input.status,
    currentPeriodStart: input.currentPeriodStart,
    currentPeriodEnd: input.currentPeriodEnd,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    canceledAt: input.canceledAt,
    metadata: input.metadata ?? null,
    updatedAt: now,
  };
  if (existing) {
    await db.update(subscription).set(row).where(eq(subscription.userId, input.userId));
  } else {
    await db.insert(subscription).values({
      ...row,
      createdAt: now,
    });
  }
}
