"use client";

import { useState } from "react";
import Link from "next/link";
import { PostModal } from "./post-modal";
import type { SocialAccount, Post } from "@/lib/db/schema";

interface QuickActionsProps {
  accounts: SocialAccount[];
  posts: Post[];
}

export function QuickActions({ accounts, posts }: QuickActionsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full rounded-2xl bg-linear-to-r from-[#5B63FF] to-[#49C4FF] px-6 py-4 text-center text-white font-semibold shadow-lg shadow-[#5B63FF]/30 hover:-translate-y-0.5 transition-transform"
        >
          Create new post
        </button>
        <Link
          href="/dashboard/accounts"
          className="w-full rounded-2xl border-2 border-dashed border-[#C5BAFF] px-6 py-4 text-center font-semibold text-[#566BFF] hover:border-[#566BFF] transition"
        >
          Connect account
        </Link>
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
