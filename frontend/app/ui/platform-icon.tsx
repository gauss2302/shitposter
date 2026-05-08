import type { SVGProps } from "react";

export type Platform =
  | "twitter"
  | "x"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "youtube"
  | "threads"
  | "facebook";

interface PlatformIconProps extends SVGProps<SVGSVGElement> {
  platform: string;
  size?: number;
}

/**
 * Monochrome platform marks. Glyphs traced from Simple Icons, single-fill,
 * sized to the type cap-height of the line they sit on. Inline SVG so they
 * inherit currentColor — the parent styles them like type.
 */
export function PlatformIcon({
  platform,
  size = 16,
  ...rest
}: PlatformIconProps) {
  const key = platform.toLowerCase();
  const Glyph = GLYPHS[key];
  if (!Glyph) return <FallbackGlyph size={size} {...rest} />;
  return <Glyph size={size} {...rest} />;
}

interface GlyphProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

const GLYPHS: Record<string, (props: GlyphProps) => React.ReactElement> = {
  twitter: XGlyph,
  x: XGlyph,
  instagram: InstagramGlyph,
  tiktok: TikTokGlyph,
  linkedin: LinkedInGlyph,
  youtube: YouTubeGlyph,
  threads: ThreadsGlyph,
  facebook: FacebookGlyph,
};

function XGlyph({ size = 16, ...rest }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramGlyph({ size = 16, ...rest }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.336 3.608 1.311.975.975 1.249 2.242 1.311 3.608.058 1.266.069 1.646.069 4.85s-.012 3.584-.07 4.85c-.062 1.366-.336 2.633-1.311 3.608-.975.975-2.242 1.249-3.608 1.311-1.266.058-1.646.069-4.85.069s-3.584-.012-4.85-.07c-1.366-.062-2.633-.336-3.608-1.311-.975-.975-1.249-2.242-1.311-3.608-.058-1.266-.069-1.646-.069-4.85s.012-3.584.07-4.85c.062-1.366.336-2.633 1.311-3.608C4.515 2.57 5.782 2.296 7.148 2.234 8.414 2.176 8.794 2.163 12 2.163zm0 1.838c-3.155 0-3.523.012-4.766.069-1.026.047-1.583.218-1.953.362-.49.19-.84.418-1.207.785-.367.367-.594.717-.785 1.207-.144.37-.315.927-.362 1.953-.057 1.243-.069 1.611-.069 4.766s.012 3.523.069 4.766c.047 1.026.218 1.583.362 1.953.19.49.418.84.785 1.207.367.367.717.594 1.207.785.37.144.927.315 1.953.362 1.243.057 1.611.069 4.766.069s3.523-.012 4.766-.069c1.026-.047 1.583-.218 1.953-.362.49-.19.84-.418 1.207-.785.367-.367.594-.717.785-1.207.144-.37.315-.927.362-1.953.057-1.243.069-1.611.069-4.766s-.012-3.523-.069-4.766c-.047-1.026-.218-1.583-.362-1.953-.19-.49-.418-.84-.785-1.207-.367-.367-.717-.594-1.207-.785-.37-.144-.927-.315-1.953-.362C15.523 4.013 15.155 4 12 4zm0 3.378a4.622 4.622 0 1 1 0 9.244 4.622 4.622 0 0 1 0-9.244zm0 7.624a3.002 3.002 0 1 0 0-6.004 3.002 3.002 0 0 0 0 6.004zm5.884-7.812a1.08 1.08 0 1 1-2.16 0 1.08 1.08 0 0 1 2.16 0z" />
    </svg>
  );
}

function TikTokGlyph({ size = 16, ...rest }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05 6.33 6.33 0 1 0 6.33 6.33V8.87a8.16 8.16 0 0 0 4.77 1.52V6.94a4.85 4.85 0 0 1-.87-.25z" />
    </svg>
  );
}

function LinkedInGlyph({ size = 16, ...rest }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function YouTubeGlyph({ size = 16, ...rest }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function ThreadsGlyph({ size = 16, ...rest }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.781 3.631 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.27 8.073c.98-1.454 2.568-2.256 4.483-2.256h.046c3.202.02 5.11 1.98 5.295 5.392.115.046.228.122.336.183 2.022.91 3.504 2.295 4.296 4.066.973 2.156.943 5.016-.063 7.176-.949 2.025-2.572 3.624-4.616 4.451-1.434.582-3.008.892-4.755.913H12.186z" />
    </svg>
  );
}

function FacebookGlyph({ size = 16, ...rest }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function FallbackGlyph({ size = 16, ...rest }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 0 0 0 18M12.5 3a17 17 0 0 1 0 18" />
    </svg>
  );
}

export function platformLabel(platform: string): string {
  const map: Record<string, string> = {
    twitter: "X",
    x: "X",
    instagram: "Instagram",
    tiktok: "TikTok",
    linkedin: "LinkedIn",
    youtube: "YouTube",
    threads: "Threads",
    facebook: "Facebook",
  };
  return map[platform.toLowerCase()] ?? platform;
}
