import { createClient } from "@/lib/supabase/server";
import { CommunityFeed } from "./community-feed";

export default async function CommunityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, cohort_id, cohorts(name)")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const orgId = membership?.org_id ?? null;
  const cohortId = membership?.cohort_id ?? null;
  const cohortName = membership?.cohorts?.name ?? null;

  // Load cohort posts (if user has a cohort).
  let cohortPosts: PostWithAuthor[] = [];
  if (cohortId) {
    const { data } = await supabase
      .from("community_posts")
      .select("id, content, likes_count, created_at, user_id, cohort_id, profiles:user_id(display_name)")
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
      .select("id, content, likes_count, created_at, user_id, cohort_id, profiles:user_id(display_name)")
      .eq("org_id", orgId)
      .is("cohort_id", null)
      .order("created_at", { ascending: false })
      .limit(50);
    alumniPosts = (data ?? []) as unknown as PostWithAuthor[];
  }

  // Load comments + user's likes for all visible posts.
  const allPostIds = [...cohortPosts, ...alumniPosts].map((p) => p.id);
  const { data: allComments } = allPostIds.length > 0
    ? await supabase.from("community_comments").select("id, post_id, content, created_at, user_id, profiles:user_id(display_name)").in("post_id", allPostIds).order("created_at")
    : { data: [] };
  const { data: userLikes } = allPostIds.length > 0
    ? await supabase.from("community_likes").select("post_id").eq("user_id", user!.id).in("post_id", allPostIds)
    : { data: [] };

  const commentsByPost: Record<string, CommentWithAuthor[]> = {};
  for (const c of (allComments ?? []) as unknown as CommentWithAuthor[]) {
    if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
    commentsByPost[c.post_id].push(c);
  }
  const likedPostIds = new Set((userLikes ?? []).map((l) => l.post_id));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy">Community</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Share what you're learning, celebrate wins, ask for help. Your cohort is here with you.
        </p>
      </div>

      <CommunityFeed
        userId={user!.id}
        orgId={orgId}
        cohortId={cohortId}
        cohortName={cohortName}
        cohortPosts={cohortPosts}
        alumniPosts={alumniPosts}
        commentsByPost={commentsByPost}
        likedPostIds={likedPostIds}
      />
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
