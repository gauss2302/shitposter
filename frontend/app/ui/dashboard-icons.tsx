import type { SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

const stroke: SVGProps<SVGSVGElement> = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/**
 * Single-stroke 24x24 icons in Lucide style. Used in the dashboard chrome
 * where emoji previously sat. Inherit currentColor — style with text-* tokens.
 */

export function LinkIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...stroke} aria-hidden {...rest}>
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}

export function CalendarIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...stroke} aria-hidden {...rest}>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

export function BarChartIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...stroke} aria-hidden {...rest}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export function TrendingUpIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...stroke} aria-hidden {...rest}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  );
}

export function SparklesIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...stroke} aria-hidden {...rest}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

export function GlobeIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...stroke} aria-hidden {...rest}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" />
    </svg>
  );
}
