import { redirect } from "next/navigation";
import { getAgentReadiness, getAiProviders, getBackendSession } from "@/lib/api/server";
import { AgentReadinessPanel } from "../components/agent-readiness-panel";
import { AiSettingsClient } from "./ai-settings-client";

export default async function AiSettingsPage() {
  const session = await getBackendSession();
  if (!session.user) redirect("/sign-in");
  const [providers, readiness] = await Promise.all([getAiProviders(), getAgentReadiness()]);

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
        <p className="mt-3 text-sm text-zinc-600">
          Once an API key has the right scopes, any compatible model you configure
          here can drive automated posts to X and LinkedIn through the Agent API.
        </p>
      </div>

      <AgentReadinessPanel readiness={readiness} context="ai" />

      <AiSettingsClient initialProviders={providers} />
    </div>
  );
}
