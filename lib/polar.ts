import { Polar } from "@polar-sh/sdk";

const accessToken = process.env.POLAR_ACCESS_TOKEN;
const serverURL = process.env.POLAR_SERVER_URL; // optional, for self-hosted

export const polar =
  accessToken &&
  new Polar({
    accessToken,
    ...(serverURL ? { serverURL } : {}),
  });

export const polarWebhookSecret = process.env.POLAR_WEBHOOK_SECRET ?? "";

/** Product IDs from Polar dashboard (one product per plan, e.g. Basic $9/mo, Business $29/mo, Enterprise $99/mo) */
export const polarProductIds = {
  basic: process.env.POLAR_PRODUCT_ID_BASIC ?? "",
  business: process.env.POLAR_PRODUCT_ID_BUSINESS ?? "",
  enterprise: process.env.POLAR_PRODUCT_ID_ENTERPRISE ?? "",
} as const;

export type PlanSlug = keyof typeof polarProductIds;

const productIdToPlan: Record<string, PlanSlug> = {
  [polarProductIds.basic]: "basic",
  [polarProductIds.business]: "business",
  [polarProductIds.enterprise]: "enterprise",
};

export function getPlanFromProductId(productId: string): PlanSlug | null {
  return productIdToPlan[productId] ?? null;
}
