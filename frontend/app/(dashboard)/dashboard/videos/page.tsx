import { redirect } from "next/navigation";
import { getBackendSession } from "@/lib/api/server";
import { VideosClient } from "./videos-client";

export default async function VideosPage() {
  const session = await getBackendSession();
  if (!session.user) redirect("/sign-in");

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">
          Video generation
        </p>
        <h1 className="mt-1 text-3xl font-bold text-[var(--color-ink)]">
          Generate and post short-form video
        </h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Submit a prompt to a Replicate-hosted video model (Kling, Pika,
          Luma, Hunyuan, …). The output lands in R2 and can be cross-posted
          to TikTok and Instagram from the posts compose flow, or scheduled
          via a recipe.
        </p>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Configure <code className="rounded bg-[var(--color-surface-1)] px-1.5 py-0.5 text-xs">REPLICATE_API_TOKEN</code> on the backend before submitting.
        </p>
      </header>

      <VideosClient />
    </div>
  );
}
