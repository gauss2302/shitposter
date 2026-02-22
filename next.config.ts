import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["eda33c1daf37.ngrok-free.app"],
  // Bundle ioredis instead of externalizing it - fixes Node.js resolution of ioredis/built/utils
  serverExternalPackages: [],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
