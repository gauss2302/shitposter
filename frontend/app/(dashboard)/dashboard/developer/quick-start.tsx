"use client";

import { useState } from "react";

interface QuickStartProps {
  baseUrl: string;
  openApiDocsUrl: string;
  apiReferenceUrl: string;
}

const SCOPES: ReadonlyArray<{ name: string; description: string }> = [
  {
    name: "accounts:read",
    description: "Read connected social accounts and platform capabilities.",
  },
  {
    name: "posts:read",
    description: "List and fetch posts, including per-platform target statuses.",
  },
  {
    name: "posts:write",
    description: "Create, edit (PATCH), and cancel (DELETE) scheduled posts.",
  },
  {
    name: "ai:generate",
    description: "Generate platform-aware post copy via AI.",
  },
  {
    name: "ai:providers:read",
    description: "List stored AI provider credentials.",
  },
  {
    name: "ai:providers:write",
    description: "Add, edit, or delete AI provider credentials.",
  },
];

export function DeveloperQuickStart({
  baseUrl,
  openApiDocsUrl,
  apiReferenceUrl,
}: QuickStartProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = async (key: string, content: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedKey(key);
      window.setTimeout(
        () => setCopiedKey((current) => (current === key ? null : current)),
        1500,
      );
    } catch {
      // Insecure context or permission denied — silent no-op.
    }
  };

  const publicBase = `${baseUrl}/api/public/v1`;

  const meCurl = `curl -H "Authorization: Bearer $KEY" \\
  ${publicBase}/me`;

  const postCurl = `curl -X POST ${publicBase}/posts \\
  -H "Authorization: Bearer $KEY" \\
  -F content="Launching today" \\
  -F socialAccountIds='["acc_123"]' \\
  -F media=@./cover.jpg`;

  return (
    <section
      className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
      aria-labelledby="public-api-quick-start-heading"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Quick start
          </p>
          <h2
            id="public-api-quick-start-heading"
            className="mt-1 text-xl font-bold text-zinc-900"
          >
            Use the public API
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Pass your token as{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
              Authorization: Bearer
            </code>{" "}
            or{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
              X-API-Key
            </code>
            . Requests need an active subscription; rate limits scale with your
            plan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={openApiDocsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:border-violet-300 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            OpenAPI ↗
          </a>
          <a
            href={apiReferenceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:border-violet-300 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            docs/API.md ↗
          </a>
        </div>
      </header>

      <dl className="mt-6 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-3">
        <dt className="text-sm font-semibold text-zinc-700">Base URL</dt>
        <dd className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800">
          <code className="overflow-x-auto">{publicBase}</code>
          <CopyButton
            label="baseUrl"
            content={publicBase}
            copiedKey={copiedKey}
            onCopy={copy}
          />
        </dd>
      </dl>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <CodeCard
          title="Verify your key"
          subtitle="GET /me"
          code={meCurl}
          label="meCurl"
          copiedKey={copiedKey}
          onCopy={copy}
        />
        <CodeCard
          title="Publish a post"
          subtitle="POST /posts (multipart)"
          code={postCurl}
          label="postCurl"
          copiedKey={copiedKey}
          onCopy={copy}
        />
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold text-zinc-700">Scopes</p>
        <ul
          className="mt-2 divide-y divide-zinc-100 rounded-2xl border border-zinc-200"
          aria-label="API key scopes"
        >
          {SCOPES.map((scope) => (
            <li
              key={scope.name}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <code className="w-48 shrink-0 font-mono text-xs text-violet-700">
                {scope.name}
              </code>
              <p className="text-sm text-zinc-600">{scope.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CopyButton({
  label,
  content,
  copiedKey,
  onCopy,
}: {
  label: string;
  content: string;
  copiedKey: string | null;
  onCopy: (label: string, content: string) => void;
}) {
  const isCopied = copiedKey === label;
  return (
    <button
      type="button"
      onClick={() => onCopy(label, content)}
      aria-label={isCopied ? "Copied to clipboard" : `Copy ${label}`}
      className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-600 hover:border-violet-300 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      {isCopied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeCard({
  title,
  subtitle,
  code,
  label,
  copiedKey,
  onCopy,
}: {
  title: string;
  subtitle: string;
  code: string;
  label: string;
  copiedKey: string | null;
  onCopy: (label: string, content: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/40">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
        <div>
          <p className="text-sm font-semibold text-zinc-800">{title}</p>
          <p className="font-mono text-xs text-zinc-500">{subtitle}</p>
        </div>
        <CopyButton
          label={label}
          content={code}
          copiedKey={copiedKey}
          onCopy={onCopy}
        />
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed text-zinc-900">
        <code>{code}</code>
      </pre>
    </div>
  );
}
