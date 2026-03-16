import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  allowedDevOrigins: ["app.shitposter.art"],
  // Bundle ioredis instead of externalizing it - fixes Node.js resolution of ioredis/built/utils
  serverExternalPackages: [],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Relaxed CSP: allow self, inline scripts (Next.js), and OAuth/social domains for frames and redirects
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "frame-src 'self' https://accounts.google.com https://twitter.com https://www.linkedin.com https://www.facebook.com https://www.tiktok.com",
              "connect-src 'self' https://api.twitter.com https://api.linkedin.com https://graph.facebook.com https://open.tiktokapis.com https://*.sentry.io",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
