"use client";

import { useState } from "react";
import Link from "next/link";
import { PostModal } from "./post-modal";
import type { SocialAccount, Post } from "@/lib/db/schema";

interface EmptyStateProps {
  accounts: SocialAccount[];
  posts: Post[];
}

export function EmptyState({ accounts, posts }: EmptyStateProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (accounts.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#C5BAFF] bg-white/80 p-12 text-center">
        <p className="text-lg font-semibold text-zinc-900 mb-2">
          No accounts connected
        </p>
        <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto">
          Connect a social media account first to start posting.
        </p>
        <Link
          href="/dashboard/accounts"
          className="inline-flex px-6 py-3 rounded-2xl bg-[#566BFF] text-white font-semibold shadow-lg shadow-[#566BFF]/30"
        >
          Connect Account
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-3xl border border-dashed border-[#C5BAFF] bg-white/80 p-12 text-center">
        <p className="text-lg font-semibold text-zinc-900 mb-2">No posts yet</p>
        <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto">
          Draft something spicy, schedule it, and we will show the play-by-play
          here.
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex px-6 py-3 rounded-2xl bg-[#566BFF] text-white font-semibold shadow-lg shadow-[#566BFF]/30 hover:bg-[#4555ef] transition"
        >
          Start Writing
        </button>
      </div>

      <PostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accounts={accounts}
        posts={posts}
      />
    </>
  );
}
