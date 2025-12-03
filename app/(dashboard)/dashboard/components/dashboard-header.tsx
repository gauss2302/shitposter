"use client";

import { useState } from "react";
import Link from "next/link";
import { PostModal } from "./post-modal";
import type { SocialAccount, Post } from "@/lib/db/schema";

interface DashboardHeaderProps {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  stats: {
    connectedAccounts: number;
    scheduledPosts: number;
    publishedPosts: number;
  };
  accounts?: SocialAccount[];
  posts?: Post[];
}

const STAT_LABELS = [
  { key: "connectedAccounts", label: "Connected Accounts" },
  { key: "scheduledPosts", label: "Scheduled Posts" },
  { key: "publishedPosts", label: "Published This Week" },
] as const;

export function DashboardHeader({
  name,
  email,
  avatarUrl,
  stats,
  accounts = [],
  posts = [],
}: DashboardHeaderProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const initials =
    name
      ?.split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "SP";

  return (
    <>
      <header className="bg-linear-to-r from-[#5B63FF] via-[#566BFF] to-[#49C4FF] rounded-[34px] p-8 text-white shadow-[0_40px_120px_rgba(86,107,255,0.35)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-2xl font-black shadow-[0_10px_30px_rgba(0,0,0,0.25)] overflow-hidden">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={name || "User avatar"}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                initials
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                Authenticated
              </p>
              <h1 className="text-3xl font-black tracking-tight">
                Welcome back, {name?.split(" ")[0] || "friend"}.
              </h1>
              {email && <p className="text-sm text-white/70">{email}</p>}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 rounded-2xl bg-white text-[#4044C9] font-bold shadow-lg shadow-white/30 hover:-translate-y-0.5 transition-transform"
            >
              Create Post
            </button>
            <Link
              href="/dashboard/accounts"
              className="px-6 py-3 rounded-2xl border border-white/30 text-white font-semibold hover:bg-white/10 transition-colors"
            >
              Manage Accounts
            </Link>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STAT_LABELS.map((stat) => (
            <div
              key={stat.key}
              className="bg-white/10 rounded-2xl p-4 border border-white/20 backdrop-blur-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
                {stat.label}
              </p>
              <p className="text-3xl font-black mt-1">{stats[stat.key] ?? 0}</p>
            </div>
          ))}
        </div>
      </header>

      <PostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accounts={accounts}
        posts={posts}
      />
    </>
  );
}
