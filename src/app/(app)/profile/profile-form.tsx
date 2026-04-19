"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { startIntakeSession } from "@/lib/intake/actions";
import { reopenIntake, type UpdateProfileInput, updateProfile } from "@/lib/profile/actions";

type Initial = {
  role_title: string;
  function_area: string;
  team_size: number | null | undefined;
  total_org_influence: number | null | undefined;
  tenure_at_org: string;
  tenure_in_leadership: string;
  company_size: string;
  industry: string;
  context_notes: string;
};

const TENURE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Select…" },
  { value: "<1y", label: "Less than a year" },
  { value: "1-3y", label: "1–3 years" },
  { value: "3-7y", label: "3–7 years" },
  { value: "7y+", label: "7+ years" },
];

const COMPANY_SIZE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Select…" },
  { value: "solo", label: "Solo" },
  { value: "<50", label: "Under 50" },
  { value: "50-250", label: "50–250" },
  { value: "250-1k", label: "250–1,000" },
  { value: "1k-5k", label: "1,000–5,000" },
  { value: "5k+", label: "5,000+" },
];

export function ProfileForm({
  initial,
  intakeCompleted,
}: {
  initial: Initial;
  intakeCompleted: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the "Saved" toast after a few seconds so it doesn't linger, but
  // reset the timer on every new save so repeated saves keep the feedback
  // visible for the same duration each time.
  useEffect(() => {
    if (saveState !== "saved") return;
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setSaveState("idle"), 4000);
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [saveState]);

  const [roleTitle, setRoleTitle] = useState(initial.role_title);
  const [functionArea, setFunctionArea] = useState(initial.function_area);
  const [teamSize, setTeamSize] = useState(
    initial.team_size != null ? String(initial.team_size) : "",
  );
  const [totalOrgInfluence, setTotalOrgInfluence] = useState(
    initial.total_org_influence != null ? String(initial.total_org_influence) : "",
  );
  const [tenureAtOrg, setTenureAtOrg] = useState(initial.tenure_at_org);
  const [tenureInLeadership, setTenureInLeadership] = useState(initial.tenure_in_leadership);
  const [companySize, setCompanySize] = useState(initial.company_size);
  const [industry, setIndustry] = useState(initial.industry);
  const [contextNotes, setContextNotes] = useState(initial.context_notes);

  const parseIntOrNull = (value: string): number | null => {
    if (value.trim() === "") return null;
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveState("idle");
    setErrorMessage(null);
    start(async () => {
      const payload: UpdateProfileInput = {
        role_title: roleTitle.trim() || null,
        function_area: functionArea.trim() || null,
        team_size: parseIntOrNull(teamSize),
        total_org_influence: parseIntOrNull(totalOrgInfluence),
        tenure_at_org: (tenureAtOrg || null) as UpdateProfileInput["tenure_at_org"],
        tenure_in_leadership: (tenureInLeadership ||
          null) as UpdateProfileInput["tenure_in_leadership"],
        company_size: (companySize || null) as UpdateProfileInput["company_size"],
        industry: industry.trim() || null,
        context_notes: contextNotes.trim() || null,
      };
      const res = await updateProfile(payload);
      if ("error" in res && res.error) {
        setSaveState("error");
        setErrorMessage(res.error);
        return;
      }
      setSaveState("saved");
      router.refresh();
    });
  };

  const handleReopenIntake = () => {
    start(async () => {
      await reopenIntake();
      // Redirects into the seeded intake conversation. If a recent one
      // exists it resumes that; otherwise a fresh opener is seeded.
      await startIntakeSession();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Row label="Role title">
        <input
          type="text"
          value={roleTitle}
          onChange={(e) => setRoleTitle(e.target.value)}
          placeholder="VP Product"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          maxLength={200}
        />
      </Row>

      <Row label="Function">
        <input
          type="text"
          value={functionArea}
          onChange={(e) => setFunctionArea(e.target.value)}
          placeholder="Product, Engineering, Sales, People Ops, …"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          maxLength={200}
        />
      </Row>

      <div className="grid gap-4 sm:grid-cols-2">
        <Row label="Direct reports">
          <input
            type="number"
            value={teamSize}
            onChange={(e) => setTeamSize(e.target.value)}
            placeholder="0"
            min={0}
            max={10000}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </Row>

        <Row
          label="Total org influence"
          hint="Including skip-levels. Optional — only if you lead other leaders."
        >
          <input
            type="number"
            value={totalOrgInfluence}
            onChange={(e) => setTotalOrgInfluence(e.target.value)}
            placeholder="0"
            min={0}
            max={1000000}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </Row>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Row label="Tenure at your org">
          <select
            value={tenureAtOrg}
            onChange={(e) => setTenureAtOrg(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          >
            {TENURE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Row>

        <Row label="Years in leadership">
          <select
            value={tenureInLeadership}
            onChange={(e) => setTenureInLeadership(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          >
            {TENURE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Row>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Row label="Company size">
          <select
            value={companySize}
            onChange={(e) => setCompanySize(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          >
            {COMPANY_SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Row>

        <Row label="Industry">
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="B2B SaaS, healthcare IT, consumer CPG…"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            maxLength={200}
          />
        </Row>
      </div>

      <Row
        label="Anything else worth your thought partner knowing"
        hint="Recent reorg, team dynamics, a big strategic push, personal context you're carrying — whatever matters."
      >
        <textarea
          value={contextNotes}
          onChange={(e) => setContextNotes(e.target.value)}
          rows={4}
          maxLength={4000}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </Row>

      {saveState === "error" && errorMessage && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          Couldn't save — {errorMessage}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saveState === "saved" && (
          <span
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"
          >
            <span
              aria-hidden
              className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white"
            >
              ✓
            </span>
            Saved to your profile
          </span>
        )}
        {intakeCompleted ? (
          <button
            type="button"
            onClick={handleReopenIntake}
            disabled={pending}
            className="text-xs text-neutral-600 hover:text-brand-blue disabled:opacity-60"
          >
            Re-run the intake conversation instead
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              start(async () => {
                await startIntakeSession();
              })
            }
            disabled={pending}
            className="text-xs text-brand-blue hover:underline disabled:opacity-60"
          >
            Prefer to chat it through? Open the intake →
          </button>
        )}
      </div>
    </form>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
