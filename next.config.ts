import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Sentry org and project are configured via SENTRY_ORG and SENTRY_PROJECT env vars.
  // Source maps are uploaded automatically in production builds when configured.
  silent: true,
  disableLogger: true,
});
