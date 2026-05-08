"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api/browser";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { ApiKey, CreatedApiKey } from "@/lib/api/types";

const AVAILABLE_SCOPES = [
  "accounts:read",
  "posts:read",
  "posts:write",
  "ai:generate",
];

export function ApiKeysClient({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("Agent integration");
  const [scopes, setScopes] = useState<string[]>(AVAILABLE_SCOPES);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleScope = (scope: string) => {
    setScopes((current) =>
      current.includes(scope)
        ? current.filter((item) => item !== scope)
        : [...current, scope]
    );
  };

  const createKey = async () => {
    setLoading(true);
    setError("");
    setCreatedToken(null);
    try {
      const response = await fetch(apiUrl(apiEndpoints.apiKeys.collection), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, scopes }),
      });
      const data = (await response.json()) as CreatedApiKey | { detail?: string };
      if (!response.ok) {
        throw new Error("detail" in data ? data.detail : "Failed to create API key");
      }
      const created = data as CreatedApiKey;
      setKeys((current) => [created.apiKey, ...current]);
      setCreatedToken(created.token);
      setName("Agent integration");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setLoading(false);
    }
  };

  const revokeKey = async (id: string) => {
    setError("");
    const response = await fetch(apiUrl(apiEndpoints.apiKeys.item(id)), {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      setError("Failed to revoke API key");
      return;
    }
    setKeys((current) =>
      current.map((key) => (key.id === id ? { ...key, isActive: false } : key))
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-900">Create API key</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Use scoped keys for external agents. The raw token is shown once.
        </p>
        <label className="mt-5 block text-sm font-semibold text-zinc-700">
          Key name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
          />
        </label>
        <div className="mt-5">
          <p className="text-sm font-semibold text-zinc-700">Scopes</p>
          <div className="mt-2 grid gap-2">
            {AVAILABLE_SCOPES.map((scope) => (
              <label
                key={scope}
                className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={() => toggleScope(scope)}
                />
                <span className="font-mono">{scope}</span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={createKey}
          disabled={loading || !name.trim() || scopes.length === 0}
          className="mt-5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create key"}
        </button>
        {createdToken && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              Copy this token now. It will not be shown again.
            </p>
            <code className="mt-2 block overflow-x-auto rounded-xl bg-white p-3 text-xs text-zinc-900">
              {createdToken}
            </code>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-900">Existing keys</h2>
        <div className="mt-4 space-y-3">
          {keys.length === 0 && (
            <p className="text-sm text-zinc-500">No API keys created yet.</p>
          )}
          {keys.map((key) => (
            <div key={key.id} className="rounded-2xl border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900">{key.name}</p>
                  <p className="text-xs text-zinc-500">
                    Prefix <span className="font-mono">{key.prefix}</span> · Created{" "}
                    {new Date(key.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    key.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {key.isActive ? "Active" : "Revoked"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {key.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="rounded-full bg-violet-50 px-2 py-1 font-mono text-xs text-violet-700"
                  >
                    {scope}
                  </span>
                ))}
              </div>
              {key.isActive && (
                <button
                  type="button"
                  onClick={() => revokeKey(key.id)}
                  className="mt-4 text-sm font-semibold text-red-600 hover:text-red-700"
                >
                  Revoke key
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
