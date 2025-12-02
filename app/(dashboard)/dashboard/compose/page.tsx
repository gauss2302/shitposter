import { auth } from "@/lib/auth";
import { db, socialAccount } from "@/lib/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { ComposeForm } from "./compose-form";

export default async function ComposePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  const accounts = await db.query.socialAccount.findMany({
    where: eq(socialAccount.userId, session!.user.id),
  });

  const activeAccounts = accounts.filter((a) => a.isActive);

  if (activeAccounts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-8 border border-zinc-200 dark:border-zinc-800 text-center">
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl">🔗</span>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
            No accounts connected
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">
            Connect at least one social media account to start posting
          </p>
          <Link
            href="/dashboard/accounts"
            className="inline-flex px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-lg transition"
          >
            Connect Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Create Post
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Compose and schedule your social media posts
        </p>
      </div>

      <ComposeForm accounts={activeAccounts} />
    </div>
  );
}
