import { redirect } from "next/navigation";
import { getAiProviders, getBackendSession } from "@/lib/api/server";
import { AiSettingsClient } from "./ai-settings-client";

export default async function AiSettingsPage() {
  const session = await getBackendSession();
  if (!session.user) redirect("/sign-in");
  const providers = await getAiProviders();

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-white to-fuchsia-50 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-fuchsia-600">
          AI models
        </p>
        <h1 className="mt-1 text-3xl font-bold text-zinc-900">
          Content generation settings
        </h1>
        <p className="mt-2 text-zinc-600">
          Add OpenAI, Claude/Anthropic, or OpenAI-compatible provider keys so the
          app and external agents can generate social content.
        </p>
      </div>

      <AiSettingsClient initialProviders={providers} />
    </div>
  );
}
