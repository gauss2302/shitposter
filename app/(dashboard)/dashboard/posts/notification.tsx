// app/(dashboard)/dashboard/posts/notification.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function PostsNotification() {
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  // Derive message from URL params
  const success = searchParams.get("success");
  const message =
    success === "created"
      ? "Post created successfully! It will be published shortly."
      : null;

  // Don't show if dismissed or no message
  if (!message || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    // Clear URL parameters
    window.history.replaceState({}, "", "/dashboard/posts");
  };

  return (
    <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-green-800 dark:text-green-200 mb-1">
              Success
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              {message}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              💡 Make sure the worker is running to process posts
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-green-600 dark:text-green-400 hover:opacity-70 transition text-xl"
        >
          ×
        </button>
      </div>
    </div>
  );
}
