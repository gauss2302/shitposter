"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { AuthLayout } from "../components/auth-layout";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        router.push("/dashboard");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Enter your details to continue"
      isSignIn={true}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-6 w-full max-w-sm mx-auto"
      >
        {error && (
          <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

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
            className="w-full px-5 py-3.5 rounded-2xl border-2 border-[#E8F9FF] bg-[#FBFBFB] text-zinc-900 focus:border-[#C5BAFF] focus:ring-4 focus:ring-[#C5BAFF]/10 outline-none transition-all font-medium placeholder:text-zinc-300"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 px-6 bg-[#C5BAFF] hover:bg-[#b4a5ff] text-white font-bold rounded-2xl transition-all shadow-lg shadow-[#C5BAFF]/30 hover:shadow-[#C5BAFF]/50 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-4"
        >
          {loading ? "Logging in..." : "Continue"}
        </button>
      </form>
    </AuthLayout>
  );
}
