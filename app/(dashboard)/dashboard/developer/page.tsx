import { redirect } from "next/navigation";
import { getApiKeys, getBackendSession } from "@/lib/api/server";
import { ApiKeysClient } from "./api-keys-client";

export default async function DeveloperPage() {
  const session = await getBackendSession();
  if (!session.user) redirect("/sign-in");
  const apiKeys = await getApiKeys();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-violet-600">
          Developer
        </p>
        <h1 className="mt-1 text-3xl font-bold text-zinc-900">
          Agent API access
        </h1>
        <p className="mt-2 max-w-3xl text-zinc-500">
          Create scoped API keys for external agents and automation systems.
          Keys can schedule posts, read account capabilities, and request AI
          generated content without using browser cookies.
        </p>
      </div>
      <ApiKeysClient initialKeys={apiKeys} />
    </div>
  );
}
