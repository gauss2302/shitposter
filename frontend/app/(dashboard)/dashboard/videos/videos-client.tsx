"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api/browser";
import { apiEndpoints } from "@/lib/api/endpoints";

interface VideoJob {
  id: string;
  provider: string;
  model: string;
  prompt: string;
  status: string;
  outputUrl: string | null;
  providerJobId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

const DEFAULT_MODEL = "kwaivgi/kling-v2.1";

export function VideosClient() {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [prompt, setPrompt] = useState(
    "A slow cinematic shot of waves rolling onto a black-sand beach at dusk."
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const res = await fetch(apiUrl(apiEndpoints.videos.jobs), {
      credentials: "include",
    });
    if (res.ok) {
      const data = (await res.json()) as { jobs: VideoJob[] };
      setJobs(data.jobs);
    }
  }

  useEffect(() => {
    void refresh();
    // Soft-refresh every 8s so users see in-flight jobs progress without a
    // dedicated event channel. Aligns with the worker's 5-15s poll cadence.
    const id = setInterval(() => {
      void refresh();
    }, 8000);
    return () => clearInterval(id);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(apiUrl(apiEndpoints.videos.generate), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "replicate",
          model: model.trim() || DEFAULT_MODEL,
          prompt: prompt.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to submit");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={submit}
        className="rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] p-6 shadow-sm space-y-4"
      >
        <div>
          <label className="text-sm font-semibold text-[var(--color-ink)]" htmlFor="model">
            Model
          </label>
          <input
            id="model"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="owner/name (e.g. kwaivgi/kling-v2.1)"
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-faint)] focus:border-[var(--color-primary)] focus:outline-none"
          />
          <p className="mt-1 text-xs text-[var(--color-faint)]">
            Any Replicate model id; common picks: kwaivgi/kling-v2.1,
            lucataco/pika-1.0, luma/ray-2, tencentarc/hunyuan-video.
          </p>
        </div>
        <div>
          <label className="text-sm font-semibold text-[var(--color-ink)]" htmlFor="prompt">
            Prompt
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
        {error && (
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting || !prompt.trim()}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-on)] transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Generate"}
        </button>
      </form>

      <div className="rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          Recent jobs
        </h2>
        {jobs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            No jobs yet. Your first generation will appear here.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-mono text-[var(--color-faint)]">
                    {job.id.slice(0, 8)}
                  </span>
                  <StatusBadge status={job.status} />
                </div>
                <p className="mt-2 text-sm text-[var(--color-ink)] line-clamp-2">
                  {job.prompt}
                </p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {job.provider} · {job.model}
                </p>
                {job.outputUrl && (
                  <a
                    href={job.outputUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
                  >
                    View video →
                  </a>
                )}
                {job.errorMessage && (
                  <p className="mt-1 text-xs text-[var(--color-danger)]">
                    {job.errorMessage}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const palette = STATUS_COLORS[status] ?? "muted";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_CLASS[palette]}`}
    >
      {status}
    </span>
  );
}

const STATUS_COLORS: Record<string, "ok" | "warn" | "err" | "muted"> = {
  uploaded: "ok",
  failed: "err",
  canceled: "err",
  processing: "warn",
  downloading: "warn",
  submitting: "warn",
  queued: "muted",
};

const BADGE_CLASS: Record<"ok" | "warn" | "err" | "muted", string> = {
  ok: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  warn: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  err: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
  muted: "bg-[var(--color-surface-1)] text-[var(--color-muted)]",
};
