import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% of transactions for perf
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0, // 100% of errors get a replay
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
