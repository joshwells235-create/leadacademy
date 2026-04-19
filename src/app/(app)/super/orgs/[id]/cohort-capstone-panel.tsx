"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setCohortCapstoneUnlocksAt } from "@/lib/capstone/actions";
import { setCohortConsultant } from "@/lib/consultant/actions";
import { superCreateCohort } from "@/lib/super/cohort-actions";

type Cohort = {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  capstone_unlocks_at: string | null;
  consultant_user_id: string | null;
};

type ConsultantCandidate = {
  user_id: string;
  display_name: string | null;
};

export function CohortCapstonePanel({
  orgId,
  cohorts,
  consultantCandidates,
}: {
  orgId: string;
  cohorts: Cohort[];
  consultantCandidates: ConsultantCandidate[];
}) {
  const candidateNameById = new Map(
    consultantCandidates.map((c) => [c.user_id, c.display_name ?? "Unnamed"]),
  );

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-navy">Cohorts ({cohorts.length})</h2>
        <div className="flex items-center gap-3">
          <CreateCohortButton orgId={orgId} />
          <Link
            href={`/super/orgs/${orgId}/assign-courses`}
            className="text-xs text-brand-blue hover:underline"
          >
            Assign courses →
          </Link>
        </div>
      </div>
      {cohorts.length === 0 ? (
        <p className="text-xs text-neutral-500">No cohorts.</p>
      ) : (
        <ul className="space-y-3">
          {cohorts.map((c) => (
            <CohortRow
              key={c.id}
              orgId={orgId}
              cohort={c}
              candidates={consultantCandidates}
              consultantName={
                c.consultant_user_id
                  ? (candidateNameById.get(c.consultant_user_id) ?? "Unknown")
                  : null
              }
            />
          ))}
        </ul>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-neutral-500">
        The consultant owns program delivery for the cohort. They must first have an active{" "}
        <code className="rounded bg-brand-light px-1">consultant</code> membership in this org —
        invite them on the People tab if they don't appear in the picker.
      </p>
    </div>
  );
}

function CohortRow({
  orgId,
  cohort,
  candidates,
  consultantName,
}: {
  orgId: string;
  cohort: Cohort;
  candidates: ConsultantCandidate[];
  consultantName: string | null;
}) {
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState(cohort.capstone_unlocks_at ?? "");
  const [editingConsultant, setEditingConsultant] = useState(false);
  const [consultantValue, setConsultantValue] = useState(cohort.consultant_user_id ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  const saveDate = (next: string | null) => {
    start(async () => {
      await setCohortCapstoneUnlocksAt(cohort.id, next);
      setEditingDate(false);
      router.refresh();
    });
  };

  const saveConsultant = (next: string | null) => {
    start(async () => {
      await setCohortConsultant(cohort.id, next);
      setEditingConsultant(false);
      router.refresh();
    });
  };

  return (
    <li className="rounded-md border border-neutral-100 bg-brand-light/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/super/orgs/${orgId}/cohorts/${cohort.id}`}
            className="text-sm font-medium text-brand-navy hover:text-brand-blue"
          >
            {cohort.name}
          </Link>
          <p className="text-[11px] text-neutral-500">
            {cohort.starts_at ?? "no start date"} → {cohort.ends_at ?? "no end date"}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Capstone unlocks
          </p>
          {editingDate ? (
            <div className="mt-1 flex items-center gap-1">
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => saveDate(dateValue || null)}
                disabled={pending}
                className="rounded-md bg-brand-blue px-2 py-1 text-[11px] font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingDate(false);
                  setDateValue(cohort.capstone_unlocks_at ?? "");
                }}
                className="text-[11px] text-neutral-500"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-center justify-end gap-2">
              <span className="text-xs font-medium text-brand-navy">
                {cohort.capstone_unlocks_at ?? "not scheduled"}
              </span>
              <button
                type="button"
                onClick={() => setEditingDate(true)}
                className="text-[11px] text-brand-blue hover:underline"
              >
                {cohort.capstone_unlocks_at ? "Change" : "Set date"}
              </button>
              {cohort.capstone_unlocks_at && (
                <button
                  type="button"
                  onClick={() => saveDate(null)}
                  disabled={pending}
                  className="text-[11px] text-neutral-500 hover:text-red-600 disabled:opacity-60"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-neutral-100 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Consultant
        </p>
        {editingConsultant ? (
          <div className="flex items-center gap-1">
            <select
              value={consultantValue}
              onChange={(e) => setConsultantValue(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
            >
              <option value="">— unassigned —</option>
              {candidates.map((c) => (
                <option key={c.user_id} value={c.user_id}>
                  {c.display_name ?? "Unnamed"}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => saveConsultant(consultantValue || null)}
              disabled={pending}
              className="rounded-md bg-brand-blue px-2 py-1 text-[11px] font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingConsultant(false);
                setConsultantValue(cohort.consultant_user_id ?? "");
              }}
              className="text-[11px] text-neutral-500"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-brand-navy">
              {consultantName ?? "not assigned"}
            </span>
            <button
              type="button"
              onClick={() => setEditingConsultant(true)}
              className="text-[11px] text-brand-blue hover:underline"
            >
              {cohort.consultant_user_id ? "Change" : "Assign"}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function CreateCohortButton({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const create = () => {
    setError(null);
    start(async () => {
      const res = await superCreateCohort(orgId, {
        name,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setName("");
      setStartsAt("");
      setEndsAt("");
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-brand-blue hover:underline"
      >
        + New cohort
      </button>
    );
  }

  return (
    <div className="w-80 rounded-md border border-neutral-200 bg-brand-light/40 p-3">
      <p className="mb-2 text-xs font-semibold text-brand-navy">Create cohort</p>
      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cohort name"
          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <div className="grid gap-2 grid-cols-2">
          <input
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
            aria-label="Starts"
          />
          <input
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
            aria-label="Ends"
          />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={create}
          disabled={pending || !name.trim()}
          className="rounded-md bg-brand-blue px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setName("");
            setStartsAt("");
            setEndsAt("");
          }}
          className="text-[11px] text-neutral-500"
        >
          Cancel
        </button>
        {error && <span className="text-[11px] text-red-700">{error}</span>}
      </div>
    </div>
  );
}
