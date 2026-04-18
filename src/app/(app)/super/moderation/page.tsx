import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModerationActions } from "./moderation-actions";

export default async function ModerationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("super_admin").eq("user_id", user!.id).maybeSingle();
  if (!profile?.super_admin) redirect("/dashboard");

  const { data: posts } = await supabase
    .from("community_posts")
    .select("id, content, likes_count, created_at, user_id, org_id, cohort_id, profiles:user_id(display_name), organizations:org_id(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: comments } = await supabase
    .from("community_comments")
    .select("id, content, created_at, user_id, post_id, profiles:user_id(display_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-brand-navy mb-2">Community Moderation</h1>
      <p className="text-sm text-neutral-600 mb-6">Review and moderate community posts and comments across all orgs.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Posts */}
        <div>
          <h2 className="text-sm font-semibold text-brand-navy mb-3">Recent Posts ({posts?.length ?? 0})</h2>
          <div className="space-y-2">
            {(posts ?? []).map((p) => (
              <div key={p.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
                      <span className="font-medium text-brand-navy">{(p.profiles as unknown as { display_name: string | null })?.display_name ?? "Unknown"}</span>
                      <span>{(p.organizations as unknown as { name: string })?.name}</span>
                      <span>{p.cohort_id ? "cohort" : "alumni"}</span>
                      <span>{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-neutral-800 line-clamp-3">{p.content}</p>
                    <span className="text-xs text-neutral-400 mt-1">{p.likes_count} likes</span>
                  </div>
                  <ModerationActions type="post" id={p.id} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comments */}
        <div>
          <h2 className="text-sm font-semibold text-brand-navy mb-3">Recent Comments ({comments?.length ?? 0})</h2>
          <div className="space-y-2">
            {(comments ?? []).map((c) => (
              <div key={c.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
                      <span className="font-medium text-brand-navy">{(c.profiles as unknown as { display_name: string | null })?.display_name ?? "Unknown"}</span>
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-neutral-800">{c.content}</p>
                  </div>
                  <ModerationActions type="comment" id={c.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
