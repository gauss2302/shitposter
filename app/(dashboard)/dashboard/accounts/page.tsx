import { auth } from "@/lib/auth";
import { db, socialAccount } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { AccountsClient } from "./accounts-client";
import { LogoutButton } from "./components";

export default async function AccountsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  const accounts = await db.query.socialAccount.findMany({
    where: eq(socialAccount.userId, session!.user.id),
    orderBy: desc(socialAccount.createdAt),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">
            Connected Accounts
          </h1>
          <p className="text-zinc-500 mt-1">
            Manage your social media connections in one place
          </p>
        </div>
        <LogoutButton />
      </div>

      {/* Main Content */}
      <AccountsClient accounts={accounts} />
    </div>
  );
}
