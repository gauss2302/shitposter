/* Client-side auth adapter for the separated FastAPI backend. */

"use client";

import { useEffect, useState } from "react";

import { apiUrl } from "@/lib/api/browser";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { AuthResult, AuthSession } from "@/lib/api/types";

async function authRequest<T>(
  path: string,
  init?: RequestInit
): Promise<{ data?: T; error?: { message: string } | null }> {
  const response = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    return {
      error: {
        message:
          body?.detail ||
          body?.error ||
          `Request failed with status ${response.status}`,
      },
    };
  }

  return { data: body as T, error: null };
}

export const signIn = {
  async email(input: { email: string; password: string }): Promise<AuthResult> {
    return authRequest<AuthSession>(apiEndpoints.auth.signIn, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async social(input: { provider: string; callbackURL?: string }) {
    const callback = input.callbackURL
      ? `?callback_url=${encodeURIComponent(input.callbackURL)}`
      : "";
    window.location.href = apiUrl(apiEndpoints.auth.oauthStart(input.provider, callback));
  },
};

export const signUp = {
  async email(input: {
    email: string;
    password: string;
    name: string;
  }): Promise<AuthResult> {
    return authRequest<AuthSession>(apiEndpoints.auth.signUp, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

export async function signOut(): Promise<void> {
  await authRequest(apiEndpoints.auth.signOut, { method: "POST" });
}

export async function getSession(): Promise<AuthSession | null> {
  const result = await authRequest<AuthSession | null>(apiEndpoints.auth.session);
  return result.data ?? null;
}

export function useSession(): { data: AuthSession | null; isPending: boolean } {
  const [data, setData] = useState<AuthSession | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    let alive = true;
    getSession()
      .then((session) => {
        if (alive) setData(session);
      })
      .finally(() => {
        if (alive) setIsPending(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { data, isPending };
}

export const authClient = {
  signOut: async (options?: {
    fetchOptions?: { onSuccess?: () => void | Promise<void> };
  }) => {
    await signOut();
    await options?.fetchOptions?.onSuccess?.();
  },
};
