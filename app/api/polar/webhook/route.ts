import { NextRequest } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { polarWebhookSecret } from "@/lib/polar";
import { getPlanFromProductId } from "@/lib/polar";
import { syncSubscription } from "@/lib/billing";
import type { PlanSlug } from "@/lib/billing";

function headersRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

async function syncFromSubscriptionPayload(data: {
  customer: { externalId?: string | null; id: string };
  productId: string;
  id: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
}) {
  const userId = data.customer.externalId;
  if (!userId || typeof userId !== "string") return;

  const plan = getPlanFromProductId(data.productId) as PlanSlug | null;
  if (!plan) return;

  await syncSubscription({
    userId,
    polarCustomerId: data.customer.id,
    polarSubscriptionId: data.id,
    plan,
    status: data.status,
    currentPeriodStart: data.currentPeriodStart,
    currentPeriodEnd: data.currentPeriodEnd,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    canceledAt: data.canceledAt,
    metadata: JSON.stringify({ productId: data.productId }),
  });
}

async function syncFromCustomerStatePayload(data: {
  id: string;
  externalId?: string | null;
  activeSubscriptions: Array<{
    id: string;
    productId: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
  }>;
}) {
  const userId = data.externalId;
  if (!userId || typeof userId !== "string") return;

  const sub = data.activeSubscriptions[0];
  if (!sub) {
    await syncSubscription({
      userId,
      polarCustomerId: data.id,
      polarSubscriptionId: null,
      plan: "basic",
      status: "canceled",
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: new Date(),
      metadata: JSON.stringify({ source: "customer.state_changed", empty: true }),
    });
    return;
  }

  const plan = getPlanFromProductId(sub.productId) as PlanSlug | null;
  if (!plan) return;

  await syncSubscription({
    userId,
    polarCustomerId: data.id,
    polarSubscriptionId: sub.id,
    plan,
    status: sub.status,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    canceledAt: sub.canceledAt,
    metadata: JSON.stringify({ productId: sub.productId }),
  });
}

export async function POST(request: NextRequest) {
  if (!polarWebhookSecret) {
    return new Response("Webhook not configured", { status: 503 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const headers = headersRecord(request.headers);

  let event: { type: string; data: unknown };
  try {
    event = validateEvent(rawBody, headers, polarWebhookSecret);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return new Response("Invalid signature", { status: 403 });
    }
    throw err;
  }

  try {
    switch (event.type) {
      case "subscription.created":
      case "subscription.updated": {
        const d = event.data as {
          customer: { externalId?: string | null; id: string };
          productId: string;
          id: string;
          status: string;
          currentPeriodStart: Date;
          currentPeriodEnd: Date;
          cancelAtPeriodEnd: boolean;
          canceledAt: Date | null;
        };
        await syncFromSubscriptionPayload(d);
        break;
      }
      case "subscription.canceled":
      case "subscription.revoked": {
        const d = event.data as {
          customer: { externalId?: string | null; id: string };
          productId: string;
          id: string;
          status: string;
          currentPeriodStart: Date;
          currentPeriodEnd: Date;
          cancelAtPeriodEnd: boolean;
          canceledAt: Date | null;
        };
        await syncFromSubscriptionPayload({
          ...d,
          status: "canceled",
          canceledAt: d.canceledAt ?? new Date(),
        });
        break;
      }
      case "customer.state_changed": {
        const d = event.data as {
          id: string;
          externalId?: string | null;
          activeSubscriptions: Array<{
            id: string;
            productId: string;
            status: string;
            currentPeriodStart: Date;
            currentPeriodEnd: Date;
            cancelAtPeriodEnd: boolean;
            canceledAt: Date | null;
          }>;
        };
        await syncFromCustomerStatePayload(d);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Polar webhook handler error", { type: event.type, err });
    return new Response("Handler error", { status: 500 });
  }

  return new Response("", { status: 202 });
}
