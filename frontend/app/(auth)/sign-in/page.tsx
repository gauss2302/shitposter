"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/api/auth";
import { AuthLayout } from "../components/auth-layout";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message || "Invalid email or password");
      } else {
        router.refresh();
        router.push("/dashboard");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async () => {
    const provider = "google";
    setOauthLoading(provider);
    setError("");

    try {
      await signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    } catch {
      setError("Failed to sign in with Google");
      setOauthLoading(null);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your shitpost.art account."
      isSignIn={true}
    >
      <div className="space-y-6 w-full max-w-sm mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div
            role="alert"
            className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger"
          >
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="ml-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-surface-1 px-4 py-3 text-ink placeholder:text-faint outline-none transition-colors focus:border-primary focus-visible:shadow-focus"
            placeholder="elon@twitter.com"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="ml-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-surface-1 px-4 py-3 text-ink placeholder:text-faint outline-none transition-colors focus:border-primary focus-visible:shadow-focus"
            placeholder="••••••••"
          />
        </div>

          <button
            type="submit"
            disabled={loading || oauthLoading !== null}
            className="mt-4 w-full rounded-md bg-primary px-6 py-3.5 text-base font-semibold text-primary-on transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>

        <div className="relative mt-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-subtle" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-surface-2 px-4 font-medium text-faint">
              Or continue with
            </span>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={handleOAuthSignIn}
            disabled={loading || oauthLoading !== null}
            aria-label="Continue with Google"
            className="grid h-12 w-12 place-items-center rounded-pill border border-border bg-surface-2 transition-colors hover:bg-surface-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {oauthLoading === "google" ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-faint border-t-transparent" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
