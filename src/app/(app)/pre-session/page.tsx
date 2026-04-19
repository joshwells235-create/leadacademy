import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PreSessionForm } from "./pre-session-form";
export const metadata: Metadata = { title: "Pre-session Prep — Leadership Academy" };

export default async function PreSessionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: notes } = await supabase
    .from("pre_session_notes")
    .select("id, want_to_discuss, whats_been_hard, whats_going_well, session_date, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Pre-session prep</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Fill this out before each coaching call so your coach can hit the ground running.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Only you and your coach see these notes — your coach can read them but can't edit them.
          Save a draft any time by hitting <span className="font-medium">Save</span>; the most
          recent entry is what your coach sees before your next session.
        </p>
      </div>

      <PreSessionForm />

      {notes && notes.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-700">Previous notes</h2>
          {notes.map((n) => (
            <div
              key={n.id}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm text-sm"
            >
              <div className="text-xs text-neutral-500 mb-2">
                {n.session_date
                  ? `Session: ${n.session_date}`
                  : new Date(n.created_at).toLocaleDateString()}
              </div>
              <p className="text-neutral-900 font-medium">Want to discuss:</p>
              <p className="text-neutral-700 mb-2">{n.want_to_discuss}</p>
              {n.whats_been_hard && (
                <>
                  <p className="text-neutral-900 font-medium">What's been hard:</p>
                  <p className="text-neutral-700 mb-2">{n.whats_been_hard}</p>
                </>
              )}
              {n.whats_going_well && (
                <>
                  <p className="text-neutral-900 font-medium">What's going well:</p>
                  <p className="text-neutral-700">{n.whats_going_well}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
