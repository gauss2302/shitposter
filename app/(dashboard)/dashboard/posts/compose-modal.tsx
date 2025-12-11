"use client";

import { useState, useEffect } from "react";
import type { SocialAccount } from "@/lib/db/schema";

const platformIcons: Record<string, string> = {
  twitter: "𝕏",
  instagram: "📸",
  tiktok: "🎵",
  linkedin: "💼",
  facebook: "📘",
  threads: "🧵",
};

const platformLimits: Record<string, number> = {
  twitter: 280,
  threads: 500,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  facebook: 63206,
};

interface ComposeModalProps {
  accounts: SocialAccount[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onShowTikTok?: (accounts: SocialAccount[]) => void;
}

export function ComposeModal({
  accounts,
  isOpen,
  onClose,
  onSuccess,
  onShowTikTok,
}: ComposeModalProps) {
  const [content, setContent] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Media upload state
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [processingMedia, setProcessingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setContent("");
      setSelectedAccounts([]);
      setScheduleDate("");
      setScheduleTime("");
      setMediaFiles([]);
      setMediaPreviews([]);
      setError("");
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const toggleAccount = (id: string) => {
    const newSelected = selectedAccounts.includes(id)
      ? selectedAccounts.filter((a) => a !== id)
      : [...selectedAccounts, id];
    
    setSelectedAccounts(newSelected);

    // Check if only TikTok accounts are selected
    if (onShowTikTok && newSelected.length > 0) {
      const selectedAccountObjects = accounts.filter((a) =>
        newSelected.includes(a.id)
      );
      const allTikTok = selectedAccountObjects.every(
        (a) => a.platform === "tiktok"
      );
      const hasNonTikTok = selectedAccountObjects.some(
        (a) => a.platform !== "tiktok"
      );

      // If all selected are TikTok and there are TikTok accounts, show TikTok modal
      if (allTikTok && !hasNonTikTok && selectedAccountObjects.length > 0) {
        onShowTikTok(selectedAccountObjects);
        onClose();
      }
    }
  };

  const getMinCharLimit = () => {
    if (selectedAccounts.length === 0) return 280;
    const selectedPlatforms = accounts
      .filter((a) => selectedAccounts.includes(a.id))
      .map((a) => a.platform);
    return Math.min(...selectedPlatforms.map((p) => platformLimits[p] || 280));
  };

  const charLimit = getMinCharLimit();
  const isOverLimit = content.length > charLimit;

  // Handle file selection with loading state
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    setProcessingMedia(true);
    setError("");

    try {
      // Validate file count
      const hasVideo = files.some((f) => f.type.startsWith("video/"));
      if (hasVideo && files.length > 1) {
        throw new Error("Cannot upload multiple files with a video");
      }

      if (files.length > 4) {
        throw new Error("Maximum 4 images allowed");
      }

      // Validate file types and sizes
      for (const file of files) {
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");

        if (!isImage && !isVideo) {
          throw new Error("Only images and videos are supported");
        }

        if (isImage && file.size > 5 * 1024 * 1024) {
          throw new Error(`Image "${file.name}" must be under 5MB`);
        }

        if (isVideo && file.size > 512 * 1024 * 1024) {
          throw new Error(`Video "${file.name}" must be under 512MB`);
        }
      }

      setMediaFiles(files);

      // Generate previews
      const previews: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = ((i + 1) / files.length) * 100;
        setUploadProgress(progress);

        const reader = new FileReader();
        const preview = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });

        previews.push(preview);
      }

      setMediaPreviews(previews);
      setUploadProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process files");
      setMediaFiles([]);
      setMediaPreviews([]);
    } finally {
      setProcessingMedia(false);
      setUploadProgress(0);
    }
  };

  // Remove media file
  const removeMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!content.trim() && mediaFiles.length === 0) {
      setError("Please enter some content or attach media");
      return;
    }

    if (selectedAccounts.length === 0) {
      setError("Please select at least one account");
      return;
    }

    if (isOverLimit) {
      setError(`Content exceeds character limit (${charLimit})`);
      return;
    }

    setLoading(true);

    try {
      let scheduledFor: string | undefined;
      let timezone: string | undefined;

      if (scheduleDate && scheduleTime) {
        // Get user's timezone
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Create date string in user's local timezone
        const localDateTimeString = `${scheduleDate}T${scheduleTime}`;

        // Create a date object - this will interpret the string in the user's local timezone
        const localDate = new Date(localDateTimeString);

        // Convert to UTC ISO string for storage
        scheduledFor = localDate.toISOString();
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("content", content);
      formData.append("socialAccountIds", JSON.stringify(selectedAccounts));
      if (scheduledFor) {
        formData.append("scheduledFor", scheduledFor);
        if (timezone) {
          formData.append("timezone", timezone);
        }
      }

      // Append media files
      mediaFiles.forEach((file) => {
        formData.append("media", file);
      });

      const res = await fetch("/api/posts", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create post");
      }

      // Success - close modal and refresh
      // Add a small delay to ensure database transaction completes
      await new Promise((resolve) => setTimeout(resolve, 500));
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            Create Post
          </h2>
          <button
            onClick={onClose}
            disabled={loading || processingMedia}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition disabled:opacity-50"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Account Selection */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                Post to
              </label>
              <div className="flex flex-wrap gap-2">
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => toggleAccount(account.id)}
                    disabled={loading || processingMedia}
                    className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition border ${
                      selectedAccounts.includes(account.id)
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span className="text-lg">
                      {platformIcons[account.platform]}
                    </span>
                    @{account.platformUsername}
                    {selectedAccounts.includes(account.id) && (
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind?"
                rows={6}
                disabled={loading || processingMedia}
                className="w-full p-4 bg-transparent text-zinc-900 dark:text-white placeholder-zinc-400 resize-none focus:outline-none text-lg disabled:opacity-50"
              />

              {/* Media Processing Indicator */}
              {processingMedia && (
                <div className="px-4 pb-4">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex-shrink-0">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                        Processing media files...
                      </p>
                      <div className="mt-2 w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Media Previews */}
              {mediaPreviews.length > 0 && !processingMedia && (
                <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                  {mediaPreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      {mediaFiles[index].type.startsWith("video/") ? (
                        <video
                          src={preview}
                          className="w-full h-32 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
                          controls
                        />
                      ) : (
                        <img
                          src={preview}
                          alt={`Upload ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
                        />
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 rounded-b-lg">
                        <p className="text-xs text-white truncate">
                          {mediaFiles[index].name}
                        </p>
                        <p className="text-xs text-white/80">
                          {(mediaFiles[index].size / 1024 / 1024).toFixed(2)}{" "}
                          MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMedia(index)}
                        disabled={loading}
                        className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg disabled:opacity-50"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-4 pb-4 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-700 pt-3">
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*,video/mp4"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={loading || processingMedia}
                    />
                    <div
                      className={`w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 dark:hover:bg-violet-900/50 flex items-center justify-center transition ${
                        (loading || processingMedia) &&
                        "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      {processingMedia ? (
                        <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg
                          className="w-5 h-5 text-violet-600 dark:text-violet-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      )}
                    </div>
                  </label>
                  {mediaFiles.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-medium">
                        {mediaFiles.length} file
                        {mediaFiles.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    isOverLimit ? "text-red-500" : "text-zinc-400"
                  }`}
                >
                  {content.length} / {charLimit}
                </span>
              </div>
            </div>

            {/* Scheduling */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                Schedule (optional)
              </label>
              <div className="flex flex-wrap gap-3">
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  disabled={loading || processingMedia}
                  className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none disabled:opacity-50"
                />
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  disabled={loading || processingMedia}
                  className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none disabled:opacity-50"
                />
                {(scheduleDate || scheduleTime) && (
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleDate("");
                      setScheduleTime("");
                    }}
                    disabled={loading || processingMedia}
                    className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-50"
                  >
                    Clear
                  </button>
                )}
              </div>
              {!scheduleDate && !scheduleTime && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                  Leave empty to post immediately
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={onClose}
                disabled={loading || processingMedia}
                className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  processingMedia ||
                  (!content.trim() && mediaFiles.length === 0) ||
                  selectedAccounts.length === 0 ||
                  isOverLimit
                }
                className="px-6 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>
                      {scheduleDate ? "Scheduling..." : "Publishing..."}
                    </span>
                  </>
                ) : (
                  <span>{scheduleDate ? "Schedule Post" : "Post Now"}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

