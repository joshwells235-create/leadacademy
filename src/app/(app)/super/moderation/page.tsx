import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ModerationFilterBar } from "./filter-bar";
import { ModerationActions } from "./moderation-actions";

const PAGE_SIZE = 50;

function rangeSinceIso(range: string | undefined): string | null {
  const now = Date.now();
  if (range === "7d") return new Date(now - 7 * 24 * 3600 * 1000).toISOString();
  if (range === "90d") return new Date(now - 90 * 24 * 3600 * 1000).toISOString();
  if (range === "all") return null;
  return new Date(now - 30 * 24 * 3600 * 1000).toISOString();
}

type Props = {
  searchParams: Promise<{
    type?: string;
    org?: string;
    range?: string;
    q?: string;
    page?: string;
  }>;
};

export default async function ModerationPage({ searchParams }: Props) {
  const supabase = await createClient();
  const params = await searchParams;
  const type = params.type ?? "both";
  const orgId = params.org ?? "all";
  const range = params.range ?? "30d";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const since = rangeSinceIso(range);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const orgList = await supabase.from("organizations").select("id, name").order("name");

  const showPosts = type === "both" || type === "posts";
  const showComments = type === "both" || type === "comments";

  const postsPromise = showPosts
    ? (() => {
        let postsQuery = supabase
          .from("community_posts")
          .select(
            "id, content, likes_count, created_at, user_id, org_id, cohort_id, profiles:user_id(display_name), organizations:org_id(name)",
            { count: "exact" },
          )
          .order("created_at", { ascending: false });
        if (since) postsQuery = postsQuery.gte("created_at", since);
        if (orgId !== "all") postsQuery = postsQuery.eq("org_id", orgId);
        if (q) postsQuery = postsQuery.ilike("content", `%${q}%`);
        return postsQuery.range(from, to);
      })()
    : Promise.resolve({ data: null, count: 0 });

  const commentsPromise = showComments
    ? (() => {
        let commentsQuery = supabase
          .from("community_comments")
          .select(
            "id, content, created_at, user_id, post_id, profiles:user_id(display_name), community_posts!inner(org_id, organizations:org_id(name))",
            { count: "exact" },
          )
          .order("created_at", { ascending: false });
        if (since) commentsQuery = commentsQuery.gte("created_at", since);
        if (orgId !== "all") commentsQuery = commentsQuery.eq("community_posts.org_id", orgId);
        if (q) commentsQuery = commentsQuery.ilike("content", `%${q}%`);
        return commentsQuery.range(from, to);
      })()
    : Promise.resolve({ data: null, count: 0 });

  const [postsRes, commentsRes] = await Promise.all([postsPromise, commentsPromise]);
  const posts = postsRes.data ?? [];
  const comments = commentsRes.data ?? [];
  const postCount = postsRes.count ?? 0;
  const commentCount = commentsRes.count ?? 0;

  const grid = type === "both" ? "grid gap-6 lg:grid-cols-2" : "grid gap-6";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-brand-navy mb-2">Community Moderation</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Review and moderate community posts and comments across all orgs.
      </p>

      <ModerationFilterBar orgs={orgList.data ?? []} query={q} />

      <div className={grid}>
        {showPosts && (
          <div>
            <h2 className="text-sm font-semibold text-brand-navy mb-3">
              Posts ({postCount.toLocaleString()})
              {postCount > PAGE_SIZE && (
                <span className="ml-2 text-xs font-normal text-neutral-500">page {page}</span>
              )}
            </h2>
            {posts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
                No posts match these filters.
              </div>
            ) : (
              <div className="space-y-2">
                {posts.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 mb-1">
                          <span className="font-medium text-brand-navy">
                            {(p.profiles as unknown as { display_name: string | null })
                              ?.display_name ?? "Unknown"}
                          </span>
                          <span>{(p.organizations as unknown as { name: string })?.name}</span>
                          <span>{p.cohort_id ? "cohort" : "alumni"}</span>
                          <span>{new Date(p.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-neutral-800 line-clamp-3">{p.content}</p>
                        <span className="text-xs text-neutral-400 mt-1">
                          {p.likes_count} like{p.likes_count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <ModerationActions type="post" id={p.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showComments && (
          <div>
            <h2 className="text-sm font-semibold text-brand-navy mb-3">
              Comments ({commentCount.toLocaleString()})
              {commentCount > PAGE_SIZE && (
                <span className="ml-2 text-xs font-normal text-neutral-500">page {page}</span>
              )}
            </h2>
            {comments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
                No comments match these filters.
              </div>
            ) : (
              <div className="space-y-2">
                {comments.map((c) => {
                  const parent = c.community_posts as unknown as {
                    org_id: string;
                    organizations: { name: string } | null;
                  } | null;
                  return (
                    <div
                      key={c.id}
                      className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 mb-1">
                            <span className="font-medium text-brand-navy">
                              {(c.profiles as unknown as { display_name: string | null })
                                ?.display_name ?? "Unknown"}
                            </span>
                            {parent?.organizations?.name && (
                              <span>{parent.organizations.name}</span>
                            )}
                            <span>{new Date(c.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm text-neutral-800">{c.content}</p>
                        </div>
                        <ModerationActions type="comment" id={c.id} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {(postCount > PAGE_SIZE || commentCount > PAGE_SIZE) && (
        <Pager
          page={page}
          totalPages={Math.max(1, Math.ceil(Math.max(postCount, commentCount) / PAGE_SIZE))}
          params={params}
        />
      )}
    </div>
  );
}

function Pager({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
}) {
  const makeHref = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    sp.set("page", String(p));
    return `/super/moderation?${sp.toString()}`;
  };
  return (
    <div className="mt-4 flex items-center justify-between text-xs">
      {page > 1 ? (
        <Link href={makeHref(page - 1)} className="text-brand-blue hover:underline">
          ← Prev
        </Link>
      ) : (
        <span className="text-neutral-400">← Prev</span>
      )}
      <span className="text-neutral-500">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={makeHref(page + 1)} className="text-brand-blue hover:underline">
          Next →
        </Link>
      ) : (
        <span className="text-neutral-400">Next →</span>
      )}
    </div>
  );
}
