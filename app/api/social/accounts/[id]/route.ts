import { auth } from "@/lib/auth";
import { db, socialAccount } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the account belongs to the user
  const account = await db.query.socialAccount.findFirst({
    where: and(
      eq(socialAccount.id, id),
      eq(socialAccount.userId, session.user.id)
    ),
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Delete the account (cascade will handle post_targets)
  await db.delete(socialAccount).where(eq(socialAccount.id, id));

  return NextResponse.json({ success: true });
}

// PATCH - Update account (e.g., reactivate)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Verify the account belongs to the user
  const account = await db.query.socialAccount.findFirst({
    where: and(
      eq(socialAccount.id, id),
      eq(socialAccount.userId, session.user.id)
    ),
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Update allowed fields
  const updates: Partial<typeof socialAccount.$inferInsert> = {};

  if (typeof body.isActive === "boolean") {
    updates.isActive = body.isActive;
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(socialAccount)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(socialAccount.id, id));
  }

  return NextResponse.json({ success: true });
}
