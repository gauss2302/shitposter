// Platform types
export type Platform =
  | "twitter"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "facebook"
  | "threads";

export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export type TargetStatus = "pending" | "publishing" | "published" | "failed";

// Platform configuration
export interface PlatformConfig {
  id: Platform;
  name: string;
  icon: string;
  color: string;
  charLimit: number;
  supportsMedia: boolean;
  supportsVideo: boolean;
  maxImages: number;
}

export const PLATFORMS: PlatformConfig[] = [
  {
    id: "twitter",
    name: "X (Twitter)",
    icon: "𝕏",
    color: "bg-black",
    charLimit: 280,
    supportsMedia: true,
    supportsVideo: true,
    maxImages: 4,
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "📸",
    color: "bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400",
    charLimit: 2200,
    supportsMedia: true,
    supportsVideo: true,
    maxImages: 10,
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: "🎵",
    color: "bg-black",
    charLimit: 2200,
    supportsMedia: true,
    supportsVideo: true,
    maxImages: 0, // Video only
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "💼",
    color: "bg-blue-700",
    charLimit: 3000,
    supportsMedia: true,
    supportsVideo: true,
    maxImages: 20,
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "📘",
    color: "bg-blue-600",
    charLimit: 63206,
    supportsMedia: true,
    supportsVideo: true,
    maxImages: 10,
  },
  {
    id: "threads",
    name: "Threads",
    icon: "🧵",
    color: "bg-black",
    charLimit: 500,
    supportsMedia: true,
    supportsVideo: true,
    maxImages: 10,
  },
];

// Helper functions
export function getPlatformConfig(
  platform: Platform
): PlatformConfig | undefined {
  return PLATFORMS.find((p) => p.id === platform);
}

export function getPlatformCharLimit(platform: Platform): number {
  return getPlatformConfig(platform)?.charLimit || 280;
}

export function getMinCharLimit(platforms: Platform[]): number {
  if (platforms.length === 0) return 280;
  return Math.min(...platforms.map((p) => getPlatformCharLimit(p)));
}
