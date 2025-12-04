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
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full rounded-xl bg-linear-to-r from-[#5B63FF] to-[#49C4FF] px-4 py-2.5 text-center text-white text-sm font-semibold shadow-md shadow-[#5B63FF]/30 hover:-translate-y-0.5 transition-transform"
        >
          Create new post
        </button>
        <Link
          href="/dashboard/accounts"
          className="w-full rounded-xl border border-dashed border-[#C5BAFF] px-4 py-2.5 text-center text-sm font-semibold text-[#566BFF] hover:border-[#566BFF] transition"
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
