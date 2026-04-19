import { tool } from "ai";
import { z } from "zod";

/**
 * `update_profile_context` — gathered during intake mode (and usable
 * anytime the learner mentions profile-shaped info in later conversations).
 * Auto-applied (no approval), so the intake flow doesn't drown in pill
 * confirmations. A small inline card renders after each save for
 * transparency.
 */

export const TENURE_BANDS = ["<1y", "1-3y", "3-7y", "7y+"] as const;
export const COMPANY_SIZE_BANDS = ["solo", "<50", "50-250", "250-1k", "1k-5k", "5k+"] as const;

export const updateProfileContextInputSchema = z
  .object({
    role_title: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe(
        "The learner's role / job title, in their own words (e.g. 'VP Product', 'Senior Manager, Customer Success', 'Founder & CEO').",
      ),
    function_area: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe(
        "What part of the business the learner sits in (e.g. 'Engineering', 'Product', 'Sales', 'People Ops', 'Finance'). Short label, not a sentence.",
      ),
    team_size: z
      .number()
      .int()
      .min(0)
      .max(10000)
      .optional()
      .describe("Number of people who directly report to the learner (count of direct reports)."),
    total_org_influence: z
      .number()
      .int()
      .min(0)
      .max(1000000)
      .optional()
      .describe(
        "Total people in the learner's org sphere including skip-levels, if they lead leaders. Set only when the learner has >5 direct reports and the multi-level structure exists. Skip otherwise.",
      ),
    tenure_at_org: z
      .enum(TENURE_BANDS)
      .optional()
      .describe("Band for how long the learner has been at their current organization."),
    tenure_in_leadership: z
      .enum(TENURE_BANDS)
      .optional()
      .describe(
        "Band for total time the learner has spent in leadership roles across their career.",
      ),
    company_size: z
      .enum(COMPANY_SIZE_BANDS)
      .optional()
      .describe(
        "Employee count band for the learner's organization. 'solo' = just the learner; '<50' = small team; up through '5k+' for enterprise.",
      ),
    industry: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe(
        "Industry the learner's business operates in, specific enough to be useful (e.g. 'B2B SaaS / fintech', 'healthcare IT', 'commercial real estate', 'consumer CPG'). A single word is usually too thin.",
      ),
    context_notes: z
      .string()
      .min(1)
      .max(4000)
      .optional()
      .describe(
        "Free-text from the 'anything else worth knowing' question — a recent reorg, a CEO change, a strategic shift, a promotion they're chasing, something they're carrying. Captured in the learner's own words. Can also be extended later as more context emerges in conversation.",
      ),
    mark_complete: z
      .boolean()
      .optional()
      .describe(
        "Set to true on the final intake call (after asking the 'anything else' question) to stamp intake_completed_at and move out of intake mode. Also set to true if the learner asks to stop the intake early — save what you have and mark complete.",
      ),
  })
  .describe(
    "At least one of the other fields must be provided (or mark_complete alone is fine to end the intake with no new info). The thought partner updates just the fields that were discussed in the current exchange — do not re-send unchanged fields.",
  );

export type UpdateProfileContextInput = z.infer<typeof updateProfileContextInputSchema>;

export type UpdateProfileContextOutput =
  | {
      ok: true;
      updated_fields: string[];
      marked_complete: boolean;
    }
  | { error: string };

export function buildUpdateProfileContextTool(
  handler: (input: UpdateProfileContextInput) => Promise<UpdateProfileContextOutput>,
) {
  return tool({
    description:
      "Save profile-context fields the learner has shared (role, team, company, industry, tenure, or free-text context). Auto-applied — no confirmation pill. Pass only the fields that were confirmed in this exchange; leave others off. Use mark_complete=true when the intake conversation is done (or the learner opts out early) to stamp intake_completed_at.",
    inputSchema: updateProfileContextInputSchema,
    execute: handler,
  });
}
