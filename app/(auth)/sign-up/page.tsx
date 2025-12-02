"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { AuthLayout } from "../components/auth-layout";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      title="Create Account"
      subtitle="Enter your details to get started"
      isSignIn={false}
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
          disabled={loading}
          className="w-full py-4 px-6 bg-[#C5BAFF] hover:bg-[#b4a5ff] text-white font-bold rounded-2xl transition-all shadow-lg shadow-[#C5BAFF]/30 hover:shadow-[#C5BAFF]/50 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-4"
        >
          {loading ? "Creating account..." : "Continue"}
        </button>
      </form>
    </AuthLayout>
  );
}
