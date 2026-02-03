// app/(dashboard)/dashboard/posts/notification.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export function PostsNotification() {
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  const [showWorkerWarning, setShowWorkerWarning] = useState(false);

  // Derive message from URL params
  const success = searchParams.get("success");
  const message =
    success === "created"
      ? "Post created successfully! It will be published shortly."
      : null;

  // Check if there are pending posts that haven't been processed
  useEffect(() => {
    // Check for pending posts after a delay to see if they're still pending
    if (success === "created") {
      const timer = setTimeout(() => {
        // Check if any posts are still in pending status
        const pendingElements = document.querySelectorAll(
          '[data-status="pending"]'
        );
        if (pendingElements.length > 0) {
          setShowWorkerWarning(true);
        }
      }, 5000); // Check after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [success]);

  // Don't show if dismissed or no message
  if (!message || dismissed) {
    if (showWorkerWarning && !dismissed) {
      return (
        <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 flex-1">
              <span className="text-lg">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                  Worker Not Running
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Posts are queued. Start worker: <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1.5 py-0.5 rounded text-xs">bun run workers/start.ts</code>
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowWorkerWarning(false);
                setDismissed(true);
              }}
              className="text-yellow-600 dark:text-yellow-400 hover:opacity-70 transition shrink-0"
            >
              ×
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    // Clear URL parameters
    window.history.replaceState({}, "", "/dashboard/posts");
  };

  return (
    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1">
          <span className="text-lg">✅</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800 dark:text-green-200 mb-1">
              Success
            </p>
            <p className="text-xs text-green-700 dark:text-green-300">
              {message}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-green-600 dark:text-green-400 hover:opacity-70 transition shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  );
}
