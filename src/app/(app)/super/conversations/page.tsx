import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CONVERSATION_MODES, ConversationFilterBar } from "./filter-bar";

const PAGE_SIZE = 50;

function rangeSinceIso(range: string | undefined): string | null {
  const now = Date.now();
  if (range === "7d") return new Date(now - 7 * 24 * 3600 * 1000).toISOString();
  if (range === "90d") return new Date(now - 90 * 24 * 3600 * 1000).toISOString();
  if (range === "all") return null;
  // Default 30d.
  return new Date(now - 30 * 24 * 3600 * 1000).toISOString();
}

type Props = {
  searchParams: Promise<{
    mode?: string;
    org?: string;
    range?: string;
    q?: string;
    page?: string;
  }>;
};

export default async function ConversationsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const params = await searchParams;
  const mode = params.mode ?? "all";
  const orgId = params.org ?? "all";
  const range = params.range ?? "30d";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const since = rangeSinceIso(range);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const orgList = await supabase.from("organizations").select("id, name").order("name");

  let query = supabase
    .from("ai_conversations")
    .select(
      "id, mode, title, last_message_at, user_id, org_id, profiles:user_id(display_name), organizations:org_id(name)",
      { count: "exact" },
    )
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (since) query = query.gte("last_message_at", since);
  if (mode !== "all" && (CONVERSATION_MODES as readonly string[]).includes(mode))
    query = query.eq("mode", mode);
  if (orgId !== "all") query = query.eq("org_id", orgId);
  if (q) query = query.ilike("title", `%${q}%`);

  const { data: conversations, count } = await query.range(from, to);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-brand-navy mb-2">AI Conversations</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Review what the AI thought partner is telling learners. Quality control for your core
        product.
      </p>

      <ConversationFilterBar orgs={orgList.data ?? []} query={q} />

      <div className="mb-3 text-xs text-neutral-500">
        {total.toLocaleString()} conversation{total === 1 ? "" : "s"}
        {total > PAGE_SIZE && (
          <>
            {" "}
            · page {page} of {totalPages}
          </>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs text-neutral-500 uppercase tracking-wide">
              <th className="text-left px-4 py-2 font-medium">Learner</th>
              <th className="text-left px-3 py-2 font-medium">Org</th>
              <th className="text-left px-3 py-2 font-medium">Title</th>
              <th className="text-left px-3 py-2 font-medium">Mode</th>
              <th className="text-left px-3 py-2 font-medium">Last active</th>
              <th className="text-right px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {(conversations ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-neutral-500">
                  No conversations match these filters.
                </td>
              </tr>
            ) : (
              (conversations ?? []).map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-neutral-50 hover:bg-brand-light transition"
                >
                  <td className="px-4 py-3 font-medium text-brand-navy">
                    {(c.profiles as unknown as { display_name: string | null })?.display_name ??
                      "Unknown"}
                  </td>
                  <td className="px-3 py-3 text-neutral-600">
                    {(c.organizations as unknown as { name: string })?.name ?? ""}
                  </td>
                  <td
                    className="px-3 py-3 text-neutral-700 max-w-[260px] truncate"
                    title={c.title ?? ""}
                  >
                    {c.title ?? <span className="text-neutral-400">Untitled</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-brand-blue-light px-2 py-0.5 text-xs text-brand-blue">
                      {c.mode}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-neutral-500">
                    {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/super/conversations/${c.id}`}
                      className="text-xs text-brand-blue hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && <Pager page={page} totalPages={totalPages} params={params} />}
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
    return `/super/conversations?${sp.toString()}`;
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
