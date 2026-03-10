/**
 * Per-platform account limits by plan.
 * null = unlimited.
 */
export type PlanSlug = "basic" | "business" | "enterprise";

export const PLAN_ACCOUNT_LIMITS: Record<PlanSlug, number | null> = {
  basic: 1,
  business: 4,
  enterprise: null,
};

export function getAccountLimitForPlan(plan: PlanSlug): number | null {
  return PLAN_ACCOUNT_LIMITS[plan];
}

export function isPlanActive(status: string): boolean {
  return status === "active";
}
