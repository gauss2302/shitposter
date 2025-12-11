"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ComposeModal } from "./compose-modal";
import { TikTokModal } from "./tiktok-modal";
import type { SocialAccount } from "@/lib/db/schema";

interface PostsClientProps {
  accounts: SocialAccount[];
}

export function PostsClient({ accounts }: PostsClientProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTikTokModalOpen, setIsTikTokModalOpen] = useState(false);
  const [tiktokAccounts, setTiktokAccounts] = useState<SocialAccount[]>([]);

  const activeAccounts = accounts.filter((a) => a.isActive);

  const handleSuccess = () => {
    // Add a small delay to ensure database transaction completes before refreshing
    setTimeout(() => {
      router.refresh();
    }, 300);
  };

  const handleShowTikTok = (tiktokAccs: SocialAccount[]) => {
    setTiktokAccounts(tiktokAccs);
    setIsTikTokModalOpen(true);
  };

  if (activeAccounts.length === 0) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 px-4 py-2 text-white font-medium transition shadow-lg shadow-violet-500/30"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        <span>Create Post</span>
      </button>

      <ComposeModal
        accounts={activeAccounts}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
        onShowTikTok={handleShowTikTok}
      />

      <TikTokModal
        accounts={tiktokAccounts}
        isOpen={isTikTokModalOpen}
        onClose={() => setIsTikTokModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}

