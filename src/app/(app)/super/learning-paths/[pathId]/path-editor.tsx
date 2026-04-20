"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmBlock } from "@/components/ui/confirm-dialog";
import {
  assignPathToCohort,
  deletePath,
  setPathCourses,
  unassignPathFromCohort,
  updatePath,
} from "@/lib/learning/path-actions";

type Path = {
  id: string;
  name: string;
  description: string | null;
  org_id: string | null;
  updated_at: string;
};
type Org = { id: string; name: string };
type Course = { id: string; title: string; status: string };
type CohortOption = { id: string; name: string; orgName: string | null };
type Assignment = {
  cohort_id: string;
  cohort_name: string;
  org_name: string | null;
  available_from: string | null;
  due_at: string | null;
};

export function PathEditor({
  path,
  orgs,
  allCourses,
  initialCourseIds,
  cohortsForPicker,
  assignments,
}: {
  path: Path;
  orgs: Org[];
  allCourses: Course[];
  initialCourseIds: string[];
  cohortsForPicker: CohortOption[];
  assignments: Assignment[];
}) {
  const [name, setName] = useState(path.name);
  const [description, setDescription] = useState(path.description ?? "");
  const [orgId, setOrgId] = useState(path.org_id ?? "");
  const [metaPending, startMeta] = useTransition();
  const [metaState, setMetaState] = useState<"idle" | "saved" | "error">("idle");
  const [metaErr, setMetaErr] = useState<string | null>(null);

  const [orderedCourseIds, setOrderedCourseIds] = useState<string[]>(initialCourseIds);
  const [coursesPending, startCourses] = useTransition();
  const [coursesState, setCoursesState] = useState<"idle" | "saved" | "error">("idle");
  const [coursesErr, setCoursesErr] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const router = useRouter();

  const courseById = new Map(allCourses.map((c) => [c.id, c]));
  const inPath = new Set(orderedCourseIds);
  const coursesNotInPath = allCourses.filter((c) => !inPath.has(c.id));

  const addCourse = (cid: string) => {
    setOrderedCourseIds((prev) => [...prev, cid]);
    setCoursesState("idle");
  };
  const removeCourse = (cid: string) => {
    setOrderedCourseIds((prev) => prev.filter((id) => id !== cid));
    setCoursesState("idle");
  };
  const move = (idx: number, dir: -1 | 1) => {
    setOrderedCourseIds((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
    setCoursesState("idle");
  };

  const saveMeta = () => {
    setMetaErr(null);
    startMeta(async () => {
      const res = await updatePath({
        pathId: path.id,
        name,
        description,
        org_id: orgId || null,
      });
      if ("error" in res) {
        setMetaState("error");
        setMetaErr(res.error);
        return;
      }
      setMetaState("saved");
      router.refresh();
    });
  };

  const saveCourses = () => {
    setCoursesErr(null);
    startCourses(async () => {
      const res = await setPathCourses({
        pathId: path.id,
        courseIds: orderedCourseIds,
      });
      if ("error" in res) {
        setCoursesState("error");
        setCoursesErr(res.error);
        return;
      }
      setCoursesState("saved");
      router.refresh();
    });
  };

  const handleDelete = () => {
    startMeta(async () => {
      const res = await deletePath(path.id);
      if ("error" in res) {
        setMetaErr(res.error);
        return;
      }
      router.push("/super/learning-paths");
    });
  };

  return (
    <div className="space-y-6">
      {/* Metadata */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-brand-navy">Path details</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
          <label className="block">
            <span className="text-xs font-medium text-neutral-600">Name</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setMetaState("idle");
              }}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-neutral-600">Org scope</span>
            <select
              value={orgId}
              onChange={(e) => {
                setOrgId(e.target.value);
                setMetaState("idle");
              }}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">All orgs (template)</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-neutral-600">Description</span>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setMetaState("idle");
              }}
              rows={2}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs">
            {metaState === "saved" && <span className="text-emerald-600">Saved.</span>}
            {metaState === "error" && metaErr && <span className="text-brand-pink">{metaErr}</span>}
          </div>
          <button
            type="button"
            onClick={saveMeta}
            disabled={metaPending}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
          >
            {metaPending ? "Saving…" : "Save details"}
          </button>
        </div>
      </section>

      {/* Course composition */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-brand-navy">Courses in this path</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Order matters — learners see this as a sequenced program. Each course's own lesson +
              course prerequisites still apply.
            </p>
          </div>
          <span className="text-[11px] text-neutral-400">{orderedCourseIds.length} courses</span>
        </div>

        {orderedCourseIds.length === 0 ? (
          <p className="mt-4 text-xs italic text-neutral-500">No courses added yet.</p>
        ) : (
          <ol className="mt-3 space-y-1">
            {orderedCourseIds.map((cid, idx) => {
              const c = courseById.get(cid);
              return (
                <li
                  key={cid}
                  className="flex items-center gap-2 rounded-md border border-neutral-100 bg-brand-light/50 px-3 py-2 text-sm"
                >
                  <span className="w-5 text-center text-xs font-semibold text-neutral-400">
                    {idx + 1}
                  </span>
                  <span className="flex-1 text-brand-navy">{c?.title ?? "(removed course)"}</span>
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="rounded p-1 text-xs text-neutral-500 hover:bg-white disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === orderedCourseIds.length - 1}
                    className="rounded p-1 text-xs text-neutral-500 hover:bg-white disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCourse(cid)}
                    className="rounded p-1 text-xs text-brand-pink hover:bg-white"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        {coursesNotInPath.length > 0 && (
          <div className="mt-4">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Add a course
            </span>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  addCourse(e.target.value);
                  e.currentTarget.value = "";
                }
              }}
              className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">Pick a course…</option>
              {coursesNotInPath.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs">
            {coursesState === "saved" && <span className="text-emerald-600">Saved.</span>}
            {coursesState === "error" && coursesErr && (
              <span className="text-brand-pink">{coursesErr}</span>
            )}
          </div>
          <button
            type="button"
            onClick={saveCourses}
            disabled={coursesPending}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
          >
            {coursesPending ? "Saving…" : "Save course list"}
          </button>
        </div>
      </section>

      {/* Cohort assignment */}
      <CohortAssignmentPanel
        pathId={path.id}
        cohortsForPicker={cohortsForPicker}
        assignments={assignments}
      />

      {/* Danger zone */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-brand-navy">Delete path</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Removing a path doesn't unassign its courses from cohorts — those stay so any per-cohort
          schedule or due-date edits aren't lost. The path framing just disappears.
        </p>
        <div className="mt-3">
          {confirmingDelete ? (
            <ConfirmBlock
              title={`Delete "${path.name}"?`}
              tone="destructive"
              confirmLabel="Delete path"
              onConfirm={handleDelete}
              onCancel={() => setConfirmingDelete(false)}
              pending={metaPending}
              error={metaErr}
            >
              Course assignments stay; only the path framing is removed.
            </ConfirmBlock>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-md border border-brand-pink/30 bg-white px-3 py-1.5 text-xs font-medium text-brand-pink hover:bg-brand-pink/5"
            >
              Delete path
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function CohortAssignmentPanel({
  pathId,
  cohortsForPicker,
  assignments,
}: {
  pathId: string;
  cohortsForPicker: CohortOption[];
  assignments: Assignment[];
}) {
  const [cohortId, setCohortId] = useState("");
  const [from, setFrom] = useState("");
  const [due, setDue] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const assigned = new Set(assignments.map((a) => a.cohort_id));
  const unassigned = cohortsForPicker.filter((c) => !assigned.has(c.id));

  const assign = () => {
    setErr(null);
    setSuccess(null);
    if (!cohortId) {
      setErr("Pick a cohort.");
      return;
    }
    start(async () => {
      const res = await assignPathToCohort({
        pathId,
        cohortId,
        available_from: from,
        due_at: due,
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setSuccess(
        `Assigned. Materialized ${res.materialized} new course assignment${
          res.materialized === 1 ? "" : "s"
        } for the cohort.`,
      );
      setCohortId("");
      setFrom("");
      setDue("");
      router.refresh();
    });
  };

  const unassign = (cid: string) => {
    start(async () => {
      const res = await unassignPathFromCohort(cid, pathId);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-brand-navy">Assign to cohorts</h2>
      <p className="mt-0.5 text-xs text-neutral-500">
        Assigning a path auto-enrolls the cohort in every course it contains. Already-assigned
        courses are left alone (their per-cohort schedule + due dates are preserved).
      </p>

      {assignments.length > 0 && (
        <ul className="mt-3 space-y-1">
          {assignments.map((a) => (
            <li
              key={a.cohort_id}
              className="flex items-center gap-2 rounded-md border border-neutral-100 bg-brand-light/40 px-3 py-2 text-sm"
            >
              <span className="flex-1">
                <span className="font-medium text-brand-navy">{a.cohort_name}</span>
                {a.org_name && (
                  <span className="ml-2 text-[11px] text-neutral-500">{a.org_name}</span>
                )}
              </span>
              {a.available_from && (
                <span className="text-[11px] text-neutral-500">From {a.available_from}</span>
              )}
              {a.due_at && <span className="text-[11px] text-amber-700">Due {a.due_at}</span>}
              <button
                type="button"
                onClick={() => unassign(a.cohort_id)}
                disabled={pending}
                className="rounded p-1 text-xs text-brand-pink hover:bg-white disabled:opacity-50"
                aria-label="Unassign"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {unassigned.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_120px_auto]">
          <select
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">Pick a cohort…</option>
            {unassigned.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.orgName ? ` · ${c.orgName}` : ""}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="Available from"
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            aria-label="Available from"
          />
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            placeholder="Due"
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            aria-label="Due"
          />
          <button
            type="button"
            onClick={assign}
            disabled={pending}
            className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
          >
            {pending ? "Assigning…" : "Assign"}
          </button>
        </div>
      )}

      {err && <p className="mt-2 text-xs text-brand-pink">{err}</p>}
      {success && <p className="mt-2 text-xs text-emerald-600">{success}</p>}
    </section>
  );
}
