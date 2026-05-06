"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/api/auth";
import { AuthLayout } from "../components/auth-layout";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
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
      const result = await signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        setError(result.error.message || "Failed to create account");
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
      // Use signIn.social for both sign-in and sign-up (Better Auth handles it)
      await signIn.social({
        provider,
        callbackURL: "/dashboard",
      });
    } catch {
      setError("Failed to sign in with Google");
      setOauthLoading(null);
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Enter your details to get started"
      isSignIn={false}
    >
      <div className="space-y-6 w-full max-w-sm mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="name"
            className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1"
          >
            Full Name
          </label>
          <div className="relative">
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-5 py-3.5 rounded-2xl border-2 border-[#E8F9FF] bg-[#FBFBFB] text-zinc-900 focus:border-[#C5BAFF] focus:ring-4 focus:ring-[#C5BAFF]/10 outline-none transition-all font-medium placeholder:text-zinc-300"
              placeholder="Elon Musk"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400 pointer-events-none opacity-0 peer-valid:opacity-100 transition-opacity">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-5 py-3.5 rounded-2xl border-2 border-[#E8F9FF] bg-[#FBFBFB] text-zinc-900 focus:border-[#C5BAFF] focus:ring-4 focus:ring-[#C5BAFF]/10 outline-none transition-all font-medium placeholder:text-zinc-300"
            placeholder="elon@twitter.com"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-5 py-3.5 rounded-2xl border-2 border-[#E8F9FF] bg-[#FBFBFB] text-zinc-900 focus:border-[#C5BAFF] focus:ring-4 focus:ring-[#C5BAFF]/10 outline-none transition-all font-medium placeholder:text-zinc-300"
            placeholder="••••••••"
          />
        </div>

          <button
            type="submit"
            disabled={loading || oauthLoading !== null}
            className="w-full py-4 px-6 bg-[#C5BAFF] hover:bg-[#b4a5ff] text-white font-bold rounded-2xl transition-all shadow-lg shadow-[#C5BAFF]/30 hover:shadow-[#C5BAFF]/50 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-4"
          >
            {loading ? "Creating account..." : "Continue"}
          </button>
        </form>

        <div className="mt-8 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-100"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-zinc-400 font-medium">
              Or Continue With
            </span>
          </div>
        </div>

        <div className="mt-6 flex gap-4 justify-center">
          <button
            onClick={handleOAuthSignIn}
            disabled={loading || oauthLoading !== null}
            className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 transition-colors bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {oauthLoading === "google" ? (
              <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
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
