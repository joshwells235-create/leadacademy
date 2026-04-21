import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserRoleContext } from "@/lib/auth/role-context";
import { createClient } from "@/lib/supabase/server";
import { CommunityFeed } from "./community-feed";
export const metadata: Metadata = { title: "Community — Leadership Academy" };

type SearchParams = Promise<{ cohort?: string }>;

export default async function CommunityPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const roleCtx = await getUserRoleContext(supabase, user.id);

  // For coach-primary users, scope the feed to cohorts they coach in. A coach
  // may have multiple coached cohorts, so we render a picker and default to
  // whichever the URL selects (or the first one).
  type CoachedCohort = { id: string; name: string; org_id: string };
  let coachedCohorts: CoachedCohort[] = [];
  if (roleCtx.coachPrimary) {
    const { data: assignments } = await supabase
      .from("coach_assignments")
      .select("cohort_id, cohorts(id, name, org_id)")
      .eq("coach_user_id", user.id)
      .is("active_to", null);
    const seen = new Set<string>();
    for (const a of assignments ?? []) {
      const c = a.cohorts as unknown as CoachedCohort | null;
      if (c && !seen.has(c.id)) {
        seen.add(c.id);
        coachedCohorts.push(c);
      }
    }
  }

  let orgId: string | null;
  let cohortId: string | null;
  let cohortName: string | null;

  if (roleCtx.coachPrimary) {
    const selected =
      coachedCohorts.find((c) => c.id === params.cohort) ?? coachedCohorts[0] ?? null;
    orgId = selected?.org_id ?? null;
    cohortId = selected?.id ?? null;
    cohortName = selected?.name ?? null;
  } else {
    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id, cohort_id, cohorts(name)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    orgId = membership?.org_id ?? null;
    cohortId = membership?.cohort_id ?? null;
    cohortName = membership?.cohorts?.name ?? null;
  }

  // Load cohort posts (if user has a cohort).
  let cohortPosts: PostWithAuthor[] = [];
  if (cohortId) {
    const { data } = await supabase
      .from("community_posts")
      .select(
        "id, content, likes_count, created_at, user_id, cohort_id, profiles:user_id(display_name)",
      )
      .eq("cohort_id", cohortId)
      .order("created_at", { ascending: false })
      .limit(50);
    cohortPosts = (data ?? []) as unknown as PostWithAuthor[];
  }

  // Load alumni posts (org-wide, null cohort_id).
  let alumniPosts: PostWithAuthor[] = [];
  if (orgId) {
    const { data } = await supabase
      .from("community_posts")
      .select(
        "id, content, likes_count, created_at, user_id, cohort_id, profiles:user_id(display_name)",
      )
      .eq("org_id", orgId)
      .is("cohort_id", null)
      .order("created_at", { ascending: false })
      .limit(50);
    alumniPosts = (data ?? []) as unknown as PostWithAuthor[];
  }

  // Load comments + user's likes for all visible posts.
  const allPostIds = [...cohortPosts, ...alumniPosts].map((p) => p.id);
  const { data: allComments } =
    allPostIds.length > 0
      ? await supabase
          .from("community_comments")
          .select("id, post_id, content, created_at, user_id, profiles:user_id(display_name)")
          .in("post_id", allPostIds)
          .order("created_at")
      : { data: [] };
  const { data: userLikes } =
    allPostIds.length > 0
      ? await supabase
          .from("community_likes")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", allPostIds)
      : { data: [] };

  const commentsByPost: Record<string, CommentWithAuthor[]> = {};
  for (const c of (allComments ?? []) as unknown as CommentWithAuthor[]) {
    if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
    commentsByPost[c.post_id].push(c);
  }
  const likedPostIdArray = (userLikes ?? []).map((l) => l.post_id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Community</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {roleCtx.coachPrimary
            ? "See what your coachees are sharing, and contribute where it'll land."
            : "Share what you're learning, celebrate wins, ask for help. Your cohort is here with you."}
        </p>
      </div>

      {roleCtx.coachPrimary && coachedCohorts.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Cohort
          </span>
          {coachedCohorts.map((c) => {
            const selected = c.id === cohortId;
            return (
              <Link
                key={c.id}
                href={`/community?cohort=${c.id}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  selected
                    ? "bg-brand-navy text-white"
                    : "bg-neutral-100 text-brand-navy hover:bg-neutral-200"
                }`}
              >
                {c.name}
              </Link>
            );
          })}
        </div>
      )}

      {roleCtx.coachPrimary && coachedCohorts.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-neutral-600">
            No coachees assigned to you yet. Once an admin assigns you learners, you'll see their
            cohort community here.
          </p>
        </div>
      ) : (
        <CommunityFeed
          userId={user.id}
          orgId={orgId}
          cohortId={cohortId}
          cohortName={cohortName}
          cohortPosts={cohortPosts}
          alumniPosts={alumniPosts}
          commentsByPost={commentsByPost}
          likedPostIds={likedPostIdArray}
        />
      )}
    </div>
  );
}

type PostWithAuthor = {
  id: string;
  content: string;
  likes_count: number;
  created_at: string;
  user_id: string;
  cohort_id: string | null;
  profiles: { display_name: string | null } | null;
};

type CommentWithAuthor = {
  id: string;
  post_id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { display_name: string | null } | null;
};
