"use client";

import { useState, useEffect, useRef } from "react";
import type { SocialAccount } from "@/lib/db/schema";

interface TikTokModalProps {
  accounts: SocialAccount[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TIKTOK_CAPTION_LIMIT = 150;
const MAX_VIDEO_SIZE = 4 * 1024 * 1024 * 1024; // 4GB
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"];

export function TikTokModal({
  accounts,
  isOpen,
  onClose,
  onSuccess,
}: TikTokModalProps) {
  const [caption, setCaption] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [processingVideo, setProcessingVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Filter to only TikTok accounts
  const tiktokAccounts = accounts.filter((a) => a.platform === "tiktok");

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCaption("");
      setSelectedAccounts([]);
      setScheduleDate("");
      setScheduleTime("");
      setVideoFile(null);
      setVideoPreview(null);
      setVideoDuration(null);
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
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingVideo(true);
    setError("");

    try {
      // Validate file type
      const isValidType = ALLOWED_VIDEO_TYPES.some((type) =>
        file.type.toLowerCase().includes(type.split("/")[1])
      );
      if (!isValidType) {
        throw new Error(
          "Invalid video format. TikTok supports: MP4, MOV, AVI, WebM"
        );
      }

      // Validate file size
      if (file.size > MAX_VIDEO_SIZE) {
        throw new Error(
          `Video file too large. Maximum size is 4GB. Got: ${(
            file.size /
            1024 /
            1024
          ).toFixed(2)}MB`
        );
      }

      // Create preview
      const reader = new FileReader();
      const preview = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read video file"));
        reader.readAsDataURL(file);
      });

      // Get video duration
      const video = document.createElement("video");
      video.preload = "metadata";
      const duration = await new Promise<number>((resolve, reject) => {
        video.onloadedmetadata = () => {
          window.URL.revokeObjectURL(video.src);
          resolve(video.duration);
        };
        video.onerror = () => reject(new Error("Failed to load video metadata"));
        video.src = URL.createObjectURL(file);
      });

      // Validate duration (3 seconds to 10 minutes)
      if (duration < 3) {
        throw new Error("Video must be at least 3 seconds long");
      }
      if (duration > 600) {
        throw new Error("Video must be no longer than 10 minutes");
      }

      setVideoFile(file);
      setVideoPreview(preview);
      setVideoDuration(duration);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process video");
      setVideoFile(null);
      setVideoPreview(null);
      setVideoDuration(null);
    } finally {
      setProcessingVideo(false);
    }
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
    setVideoDuration(null);
    if (videoRef.current) {
      videoRef.current.src = "";
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!videoFile) {
      setError("Please select a video file");
      return;
    }

    if (selectedAccounts.length === 0) {
      setError("Please select at least one TikTok account");
      return;
    }

    if (caption.length > TIKTOK_CAPTION_LIMIT) {
      setError(`Caption exceeds character limit (${TIKTOK_CAPTION_LIMIT})`);
      return;
    }

    setLoading(true);

    try {
      let scheduledFor: string | undefined;
      let timezone: string | undefined;

      if (scheduleDate && scheduleTime) {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const localDateTimeString = `${scheduleDate}T${scheduleTime}`;
        const localDate = new Date(localDateTimeString);
        scheduledFor = localDate.toISOString();
      }

      const formData = new FormData();
      formData.append("content", caption);
      formData.append("socialAccountIds", JSON.stringify(selectedAccounts));
      if (scheduledFor) {
        formData.append("scheduledFor", scheduledFor);
        if (timezone) {
          formData.append("timezone", timezone);
        }
      }
      formData.append("media", videoFile);

      const res = await fetch("/api/posts", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create post");
      }

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
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎵</span>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              Create TikTok Post
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading || processingVideo}
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
            {/* TikTok Requirements Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                TikTok Video Requirements
              </h3>
              <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                <li>• Format: MP4, MOV, AVI, or WebM</li>
                <li>• Size: Up to 4GB</li>
                <li>• Duration: 3 seconds to 10 minutes</li>
                <li>• Resolution: 360×360 to 4096×4096 pixels</li>
              </ul>
            </div>

            {/* Account Selection */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                Post to TikTok Account
              </label>
              <div className="flex flex-wrap gap-2">
                {tiktokAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => toggleAccount(account.id)}
                    disabled={loading || processingVideo}
                    className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition border ${
                      selectedAccounts.includes(account.id)
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span className="text-lg">🎵</span>
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

            {/* Video Upload */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              {!videoPreview ? (
                <div className="p-8 text-center">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
                      onChange={handleVideoSelect}
                      className="hidden"
                      disabled={loading || processingVideo}
                    />
                    <div
                      className={`mx-auto w-20 h-20 rounded-full bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 dark:hover:bg-violet-900/50 flex items-center justify-center transition mb-4 ${
                        (loading || processingVideo) &&
                        "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      {processingVideo ? (
                        <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg
                          className="w-10 h-10 text-violet-600 dark:text-violet-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      )}
                    </div>
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      {processingVideo
                        ? "Processing video..."
                        : "Click to upload video"}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      MP4, MOV, AVI, or WebM • Max 4GB
                    </p>
                  </label>
                </div>
              ) : (
                <div className="relative">
                  <video
                    ref={videoRef}
                    src={videoPreview}
                    className="w-full max-h-96 object-contain bg-zinc-900"
                    controls
                  />
                  <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                    {videoFile && (
                      <>
                        <p className="text-xs">
                          {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {videoDuration && (
                          <p className="text-xs">
                            {formatDuration(videoDuration)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={removeVideo}
                    disabled={loading}
                    className="absolute top-4 right-4 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Caption */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption for your TikTok video..."
                rows={4}
                disabled={loading || processingVideo}
                maxLength={TIKTOK_CAPTION_LIMIT}
                className="w-full p-4 bg-transparent text-zinc-900 dark:text-white placeholder-zinc-400 resize-none focus:outline-none text-lg disabled:opacity-50"
              />
              <div className="px-4 pb-4 flex justify-end">
                <span
                  className={`text-sm font-medium ${
                    caption.length > TIKTOK_CAPTION_LIMIT
                      ? "text-red-500"
                      : "text-zinc-400"
                  }`}
                >
                  {caption.length} / {TIKTOK_CAPTION_LIMIT}
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
                  disabled={loading || processingVideo}
                  className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none disabled:opacity-50"
                />
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  disabled={loading || processingVideo}
                  className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none disabled:opacity-50"
                />
                {(scheduleDate || scheduleTime) && (
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleDate("");
                      setScheduleTime("");
                    }}
                    disabled={loading || processingVideo}
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
                disabled={loading || processingVideo}
                className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  processingVideo ||
                  !videoFile ||
                  selectedAccounts.length === 0 ||
                  caption.length > TIKTOK_CAPTION_LIMIT
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

