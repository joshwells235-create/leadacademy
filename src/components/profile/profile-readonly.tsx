export type ProfileViewRow = {
  role_title: string | null;
  function_area: string | null;
  team_size: number | null;
  total_org_influence: number | null;
  tenure_at_org: string | null;
  tenure_in_leadership: string | null;
  company_size: string | null;
  industry: string | null;
  context_notes: string | null;
  intake_completed_at: string | null;
};

const TENURE_LABEL: Record<string, string> = {
  "<1y": "Less than a year",
  "1-3y": "1–3 years",
  "3-7y": "3–7 years",
  "7y+": "7+ years",
};

const COMPANY_SIZE_LABEL: Record<string, string> = {
  solo: "Solo",
  "<50": "Under 50 people",
  "50-250": "50–250 people",
  "250-1k": "250–1,000 people",
  "1k-5k": "1,000–5,000 people",
  "5k+": "5,000+ people",
};

/**
 * Read-only profile view for coach / consultant / admin learner-detail pages.
 * Shows whatever the learner has filled in; gently notes when nothing's been
 * captured yet.
 */
export function ProfileReadonly({ profile }: { profile: ProfileViewRow | null }) {
  if (!profile) {
    return <p className="text-sm text-neutral-500">No profile yet.</p>;
  }

  const rows: Array<{ label: string; value: string | null }> = [
    { label: "Role", value: profile.role_title },
    { label: "Function", value: profile.function_area },
    {
      label: "Team",
      value:
        profile.team_size != null
          ? `${profile.team_size} direct report${profile.team_size === 1 ? "" : "s"}${
              profile.total_org_influence != null && profile.total_org_influence > profile.team_size
                ? ` (~${profile.total_org_influence} across the broader org)`
                : ""
            }`
          : profile.total_org_influence != null
            ? `~${profile.total_org_influence} across the broader org`
            : null,
    },
    {
      label: "Tenure at org",
      value: profile.tenure_at_org
        ? (TENURE_LABEL[profile.tenure_at_org] ?? profile.tenure_at_org)
        : null,
    },
    {
      label: "Leadership tenure",
      value: profile.tenure_in_leadership
        ? (TENURE_LABEL[profile.tenure_in_leadership] ?? profile.tenure_in_leadership)
        : null,
    },
    {
      label: "Company",
      value:
        profile.company_size || profile.industry
          ? [
              profile.company_size
                ? (COMPANY_SIZE_LABEL[profile.company_size] ?? profile.company_size)
                : null,
              profile.industry,
            ]
              .filter(Boolean)
              .join(" · ")
          : null,
    },
  ];

  const filled = rows.filter((r) => r.value);

  if (filled.length === 0 && !profile.context_notes) {
    return (
      <p className="text-sm text-neutral-500">
        Profile not yet gathered. The learner can run the intake with their thought partner on their
        first visit.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {filled.map((r) => (
        <div key={r.label} className="flex gap-3 text-sm">
          <div className="w-36 shrink-0 text-xs font-medium uppercase tracking-wide text-neutral-500">
            {r.label}
          </div>
          <div className="text-neutral-800">{r.value}</div>
        </div>
      ))}
      {profile.context_notes && (
        <div className="mt-3 rounded-md bg-brand-light/60 p-3 text-sm text-neutral-700">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Context they shared
          </div>
          <p className="whitespace-pre-wrap">{profile.context_notes}</p>
        </div>
      )}
    </div>
  );
}
