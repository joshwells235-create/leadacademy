/**
 * Seeds a super_admin user + the bootstrap "LeadShift" org.
 *
 * Usage:
 *   pnpm seed:super-admin -- --email you@example.com --password 'at-least-12-chars'
 *
 * Safe to run repeatedly: idempotent on org slug + user email.
 */
import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";
import { config } from "dotenv";
import type { Database } from "../src/lib/types/database";

config({ path: ".env.local" });

// pnpm passes `--` through to the script; filter it so parseArgs doesn't
// treat what follows as positional.
const rawArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const { values } = parseArgs({
  args: rawArgs,
  options: {
    email: { type: "string" },
    password: { type: "string" },
    name: { type: "string", default: "LeadShift Admin" },
    orgName: { type: "string", default: "LeadShift" },
    orgSlug: { type: "string", default: "leadshift" },
  },
});

if (!values.email || !values.password) {
  console.error("Usage: pnpm seed:super-admin -- --email <email> --password <password>");
  process.exit(1);
}

if (values.password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const admin = createClient<Database>(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = values.email!;
  const password = values.password!;
  const name = values.name!;

  // 1. Create or find user.
  // Look up existing user by listing (admin API has no getByEmail).
  let userId: string | null = null;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    userId = existing.id;
    console.log(`✓ User already exists: ${email} (${userId})`);
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
    });
    if (createErr || !created.user) throw createErr ?? new Error("user creation failed");
    userId = created.user.id;
    console.log(`✓ Created user: ${email} (${userId})`);
  }

  // 2. Ensure profile exists (trigger should have done it) and flip super_admin.
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      { user_id: userId, display_name: name, super_admin: true },
      { onConflict: "user_id" },
    );
  if (profileErr) throw profileErr;
  console.log("✓ Profile.super_admin = true");

  // 3. Ensure bootstrap org exists.
  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .upsert(
      { name: values.orgName!, slug: values.orgSlug! },
      { onConflict: "slug" },
    )
    .select()
    .single();
  if (orgErr) throw orgErr;
  console.log(`✓ Org: ${orgRow.name} (${orgRow.slug})`);

  // 4. Ensure membership as org_admin.
  const { error: memErr } = await admin
    .from("memberships")
    .upsert(
      { org_id: orgRow.id, user_id: userId, role: "org_admin", status: "active" },
      { onConflict: "org_id,user_id" },
    );
  if (memErr) throw memErr;
  console.log(`✓ Membership: org_admin in ${orgRow.name}`);

  console.log("\nDone. You can sign in at /login.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
