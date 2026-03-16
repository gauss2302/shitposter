import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getBaseUrl } from "@/lib/env";
import { polar } from "@/lib/polar";

export async function POST() {
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

  const returnUrl = `${getBaseUrl()}/dashboard/accounts`;

  try {
    const customerSession = await polar.customerSessions.create({
      externalCustomerId: session.user.id,
      returnUrl,
    });

    return new Response(
      JSON.stringify({ url: customerSession.customerPortalUrl }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Portal session creation failed" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
