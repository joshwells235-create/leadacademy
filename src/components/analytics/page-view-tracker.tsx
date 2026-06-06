"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Fire-and-forget page-view beacon. Mounted once in the app layout so it
 * runs for every authenticated user. On each pathname change it POSTs to
 * /api/track, which records { user_id, path } for the super-admin journey
 * timeline. Never awaited, never throws into the page — navigation is
 * never blocked by tracking.
 *
 * Only real route changes are recorded (the ref guards against duplicate
 * fires for the same path, e.g. query-param-only changes that re-run the
 * effect).
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (last.current === pathname) return;
    last.current = pathname;
    try {
      void fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: pathname }),
        keepalive: true,
      }).catch(() => {
        // swallow — tracking is best-effort
      });
    } catch {
      // swallow
    }
  }, [pathname]);

  return null;
}
