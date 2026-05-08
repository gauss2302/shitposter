import { redirect } from "next/navigation";
import { getAgentReadiness, getApiKeys, getBackendSession } from "@/lib/api/server";
import { AgentReadinessPanel } from "../components/agent-readiness-panel";
import { ApiKeysClient } from "./api-keys-client";

export default async function DeveloperPage() {
  const session = await getBackendSession();
  if (!session.user) redirect("/sign-in");
  const [apiKeys, readiness] = await Promise.all([getApiKeys(), getAgentReadiness()]);

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
          Keys can schedule posts, read connected social accounts, register
          encrypted Claude or OpenAI credentials, generate copy, and publish
          over HTTPS using{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm">
            Authorization: Bearer
          </code>{" "}
          or{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm">
            X-API-Key
          </code>{" "}
          on the{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm">
            /api/v1/agent
          </code>{" "}
          routes. The readiness card below confirms the full model-to-post path
          for your account—no guesswork.
        </p>
      </div>

      <AgentReadinessPanel readiness={readiness} context="developer" />

      <ApiKeysClient initialKeys={apiKeys} />
    </div>
  );
}
