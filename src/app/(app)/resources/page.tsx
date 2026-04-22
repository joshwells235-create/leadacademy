import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddResourceForm } from "./add-resource-form";
import { ResourceGrid } from "./resource-grid";
export const metadata: Metadata = { title: "Resources — Leadership Academy" };

export default async function ResourcesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("super_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: resources } = await supabase
    .from("resources")
    .select("id, title, description, url, type, category, created_at")
    .order("created_at", { ascending: false });

  const categories = [
    ...new Set((resources ?? []).map((r) => r.category).filter(Boolean) as string[]),
  ].sort();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          Resources
        </p>
        <h1
          className="mt-2 leading-[1.08] text-ink"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
          }}
        >
          Worth keeping.
        </h1>
        <p className="mt-3 max-w-[680px] text-[15px] leading-[1.6] text-ink-soft">
          Curated articles, videos, PDFs, and tools to support your growth.
        </p>
      </div>

      {profile?.super_admin && <AddResourceForm />}

      {!resources || resources.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h2 className="font-semibold text-brand-navy">Still being curated</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-600">
            {profile?.super_admin
              ? "Add the first resource above."
              : "The LeadShift team curates articles, videos, and tools here as the program unfolds. Your thought partner will also point you to specific resources in the flow of conversation when something fits."}
          </p>
        </div>
      ) : (
        <ResourceGrid resources={resources} categories={categories} />
      )}
    </div>
  );
}
