"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/dashboard", label: "Overview" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/cohorts", label: "Cohorts" },
  { href: "/admin/activity", label: "Activity" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="mt-3 flex gap-1" aria-label="Admin sections">
      {TABS.map((t) => {
        const active =
          pathname === t.href ||
          (t.href === "/admin/cohorts" && pathname.startsWith("/admin/cohorts"));
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-brand-blue text-white"
                : "text-neutral-600 hover:bg-brand-light hover:text-brand-navy"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
