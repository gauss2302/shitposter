/* Client-side auth adapter for the separated FastAPI backend.
 *
 * The UI intentionally keeps a small compatibility surface (`signIn.email`,
 * `signUp.email`, `authClient.signOut`, `useSession`) so auth components can
 * migrate away from Better Auth without a large rewrite.
 */

"use client";

import { useEffect, useState } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface AuthSession {
  user: AuthUser;
}

interface AuthResult {
  data?: AuthSession | null;
  error?: { message: string } | null;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";

async function authRequest<T>(
  path: string,
  init?: RequestInit
): Promise<{ data?: T; error?: { message: string } | null }> {
  const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
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
    return authRequest<AuthSession>("/auth/sign-in", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async social(input: { provider: string; callbackURL?: string }) {
    const callback = input.callbackURL
      ? `?callback_url=${encodeURIComponent(input.callbackURL)}`
      : "";
    window.location.href = `${API_BASE_URL}/api/v1/auth/${input.provider}/start${callback}`;
  },
};

export const signUp = {
  async email(input: {
    email: string;
    password: string;
    name: string;
  }): Promise<AuthResult> {
    return authRequest<AuthSession>("/auth/sign-up", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

export async function signOut(): Promise<void> {
  await authRequest("/auth/sign-out", { method: "POST" });
}

export async function getSession(): Promise<AuthSession | null> {
  const result = await authRequest<AuthSession | null>("/auth/session");
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
