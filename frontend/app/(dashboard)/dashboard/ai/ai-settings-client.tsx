"use client";

import { useMemo, useState } from "react";
import { apiUrl } from "@/lib/api/browser";
import { apiEndpoints } from "@/lib/api/endpoints";
import type {
  AiGenerateResponse,
  AiProviderCredential,
  AiProviderCredentialRequest,
} from "@/lib/api/types";

interface AiSettingsClientProps {
  initialProviders: AiProviderCredential[];
}

const providerOptions = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic / Claude" },
  { id: "openai_compatible", label: "OpenAI-compatible" },
];

export function AiSettingsClient({ initialProviders }: AiSettingsClientProps) {
  const [providers, setProviders] =
    useState<AiProviderCredential[]>(initialProviders);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<AiGenerateResponse | null>(null);
  const [form, setForm] = useState<AiProviderCredentialRequest>({
    provider: "openai",
    displayName: "OpenAI",
    apiKey: "",
    defaultModel: "gpt-4o-mini",
    baseUrl: "",
  });
  const [prompt, setPrompt] = useState(
    "Write a launch post for an agent-accessible social scheduling API."
  );

  const activeProvider = useMemo(
    () => providers.find((provider) => provider.isActive) ?? providers[0],
    [providers]
  );

  async function refreshProviders() {
    const res = await fetch(apiUrl(apiEndpoints.ai.providers), {
      credentials: "include",
    });
    if (res.ok) {
      setProviders((await res.json()) as AiProviderCredential[]);
    }
  }

  async function createProvider(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(apiUrl(apiEndpoints.ai.providers), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to save provider");
      }
      setMessage("Provider saved. The API key is encrypted and hidden.");
      setForm((current) => ({ ...current, apiKey: "" }));
      await refreshProviders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save provider");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProvider(providerId: string) {
    setMessage("");
    const res = await fetch(apiUrl(apiEndpoints.ai.provider(providerId)), {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      setMessage("Failed to delete provider.");
      return;
    }
    await refreshProviders();
  }

  async function toggleProvider(provider: AiProviderCredential) {
    setMessage("");
    const res = await fetch(apiUrl(apiEndpoints.ai.provider(provider.id)), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !provider.isActive }),
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(data?.detail || "Failed to update provider.");
      return;
    }
    await refreshProviders();
  }

  async function generatePreview() {
    setGenerating(true);
    setMessage("");
    try {
      const res = await fetch(apiUrl(apiEndpoints.ai.generate), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          providerCredentialId: activeProvider?.id,
          platforms: ["twitter", "linkedin"],
          maxCandidates: 2,
          tone: "confident, concise, useful",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to generate content");
      }
      setPreview(data as AiGenerateResponse);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-900">Add AI provider</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Keys are encrypted by the backend and never returned after saving.
        </p>
        <form onSubmit={createProvider} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-zinc-700">
            Provider
            <select
              value={form.provider}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  provider: event.target.value,
                  displayName:
                    providerOptions.find((option) => option.id === event.target.value)
                      ?.label ?? current.displayName,
                }))
              }
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
            >
              {providerOptions.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            Display name
            <input
              value={form.displayName}
              onChange={(event) =>
                setForm((current) => ({ ...current, displayName: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            API key
            <input
              type="password"
              value={form.apiKey}
              onChange={(event) =>
                setForm((current) => ({ ...current, apiKey: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
              placeholder="sk-..."
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            Default model
            <input
              value={form.defaultModel}
              onChange={(event) =>
                setForm((current) => ({ ...current, defaultModel: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
            />
          </label>
          {form.provider === "openai_compatible" && (
            <label className="block text-sm font-medium text-zinc-700">
              Base URL
              <input
                value={form.baseUrl ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, baseUrl: event.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                placeholder="https://api.example.com/v1"
              />
            </label>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-zinc-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save encrypted provider"}
          </button>
        </form>
        {message && <p className="mt-4 text-sm text-zinc-600">{message}</p>}
      </section>

      <section className="space-y-6">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-900">Configured providers</h2>
          <div className="mt-4 space-y-3">
            {providers.length === 0 ? (
              <p className="text-sm text-zinc-500">No AI providers saved yet.</p>
            ) : (
              providers.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between rounded-2xl border border-zinc-200 p-4"
                >
                  <div>
                    <p className="font-semibold text-zinc-900">{provider.displayName}</p>
                    <p className="text-sm text-zinc-500">
                      {provider.provider} · {provider.defaultModel} · key hidden
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {provider.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleProvider(provider)}
                      className="text-sm font-semibold text-violet-600"
                    >
                      {provider.isActive ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProvider(provider.id)}
                      className="text-sm font-semibold text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-900">Generation smoke test</h2>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={4}
            className="mt-4 w-full rounded-2xl border border-zinc-200 p-3"
          />
          <button
            type="button"
            onClick={generatePreview}
            disabled={generating || !activeProvider}
            className="mt-3 rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate preview"}
          </button>
          {preview && (
            <div className="mt-4 space-y-3">
              {preview.candidates.map((candidate, index) => (
                <div key={index} className="rounded-2xl bg-zinc-50 p-4 text-sm">
                  <p className="whitespace-pre-wrap text-zinc-900">{candidate.content}</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {candidate.charCount} chars · {preview.provider}/{preview.model}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
