import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { polar, polarProductIds, type PlanSlug } from "@/lib/polar";

const VALID_PLANS: PlanSlug[] = ["basic", "business", "enterprise"];

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!polar) {
    return new Response(
      JSON.stringify({ error: "Polar is not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { plan?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const plan = body.plan as PlanSlug | undefined;
  if (!plan || !VALID_PLANS.includes(plan)) {
    return new Response(
      JSON.stringify({ error: "Invalid or missing plan" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const productId = polarProductIds[plan];
  if (!productId) {
    return new Response(
      JSON.stringify({ error: "Plan not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const successUrl = `${baseUrl}/dashboard/accounts?success=subscribed`;
  const returnUrl = `${baseUrl}/dashboard/accounts`;

  try {
    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl,
      returnUrl,
      customerEmail: session.user.email ?? undefined,
      customerName: session.user.name ?? undefined,
      externalCustomerId: session.user.id,
      metadata: { userId: session.user.id },
    });

    return new Response(
      JSON.stringify({ url: checkout.url, checkoutId: checkout.id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Checkout creation failed" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
