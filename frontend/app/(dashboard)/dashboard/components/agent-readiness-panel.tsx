import Link from "next/link";

import type { AgentReadiness } from "@/lib/api/types";

interface AgentReadinessPanelProps {
  readiness: AgentReadiness;
  /** Where this panel is shown — adjusts heading and quick links emphasis */
  context: "developer" | "ai";
}

export function AgentReadinessPanel({ readiness, context }: AgentReadinessPanelProps) {
  const heading =
    context === "developer"
      ? "Agent automation readiness"
      : "Model → generate → post";

  return (
    <section
      className={`rounded-3xl border p-6 shadow-sm ${
        readiness.readyToAutomate
          ? "border-emerald-200 bg-gradient-to-br from-white to-emerald-50"
          : "border-amber-200 bg-gradient-to-br from-white to-amber-50"
      }`}
      aria-label="Agent automation readiness"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Confidence check
          </p>
          <h2 className="mt-1 text-xl font-bold text-zinc-900">{heading}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600">
            {readiness.summary}
          </p>
        </div>
        <div
          className={`shrink-0 rounded-2xl px-4 py-2 text-center text-sm font-semibold ${
            readiness.readyToAutomate
              ? "bg-emerald-600 text-white"
              : "bg-amber-600 text-white"
          }`}
        >
          {readiness.readyToAutomate ? "Ready to automate" : "Setup incomplete"}
        </div>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        AI source:{" "}
        <span className="font-mono text-zinc-700">{readiness.aiConfigurationSource}</span>
        {readiness.hasAiConfiguration && readiness.aiConfigurationSource === "user_models"
          ? " — your saved provider keys are used when agents pass providerCredentialId."
          : null}
        {readiness.hasAiConfiguration && readiness.aiConfigurationSource === "server_defaults"
          ? " — workspace default keys apply when no personal provider is selected."
          : null}
      </p>

      <ul className="mt-6 space-y-3">
        {readiness.checks.map((check) => (
          <li
            key={check.id}
            className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm ${
              check.ok
                ? "border-emerald-100 bg-white/80"
                : check.required
                  ? "border-amber-100 bg-white/90"
                  : "border-zinc-100 bg-white/60"
            }`}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                check.ok
                  ? "bg-emerald-600"
                  : check.required
                    ? "bg-amber-600"
                    : "bg-zinc-500"
              }`}
              aria-hidden
            >
              {check.ok ? "✓" : check.required ? "!" : "·"}
            </span>
            <div>
              <p className="font-semibold text-zinc-900">
                {check.title}
                {!check.required && (
                  <span className="ml-2 font-normal text-zinc-400">(optional)</span>
                )}
              </p>
              <p className="mt-1 text-zinc-600">{check.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-zinc-200/80 pt-5 text-sm">
        <span className="w-full font-medium text-zinc-700">Quick links</span>
        <Link
          href="/dashboard/accounts"
          className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-800 hover:border-violet-300 hover:text-violet-700"
        >
          Accounts & channels
        </Link>
        <Link
          href="/dashboard/ai"
          className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-800 hover:border-violet-300 hover:text-violet-700"
        >
          AI models
        </Link>
        <Link
          href="/dashboard/developer"
          className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-800 hover:border-violet-300 hover:text-violet-700"
        >
          API keys
        </Link>
      </div>
    </section>
  );
}
