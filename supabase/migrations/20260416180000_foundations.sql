-- =====================================================================
-- Phase 0: Foundations
-- -------------------------------------------------------------------
-- Organizations, profiles, memberships, cohorts, coach assignments,
-- invitations, activity logs. Helper functions and RLS policies.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. updated_at trigger helper
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. organizations
-- ---------------------------------------------------------------------
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 200),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  logo_url    text,
  settings    jsonb not null default '{}'::jsonb,
  status      text not null default 'active' check (status in ('active','archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text check (display_name is null or char_length(display_name) between 1 and 100),
  avatar_url    text,
  timezone      text not null default 'America/New_York',
  super_admin   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create a profile row when a new auth.users row appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', null))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. memberships
-- ---------------------------------------------------------------------
create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('learner','coach','org_admin')),
  cohort_id  uuid,
  status     text not null default 'active' check (status in ('active','invited','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index memberships_user_id_idx on public.memberships(user_id);
create index memberships_org_id_idx on public.memberships(org_id);
create index memberships_cohort_id_idx on public.memberships(cohort_id);

create trigger memberships_set_updated_at
before update on public.memberships
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. cohorts
-- ---------------------------------------------------------------------
create table if not exists public.cohorts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 200),
  description text check (description is null or char_length(description) <= 5000),
  starts_at   date,
  ends_at     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index cohorts_org_id_idx on public.cohorts(org_id);

create trigger cohorts_set_updated_at
before update on public.cohorts
for each row execute function public.set_updated_at();

alter table public.memberships
  add constraint memberships_cohort_fk
  foreign key (cohort_id) references public.cohorts(id) on delete set null;

-- ---------------------------------------------------------------------
-- 6. coach_assignments
-- ---------------------------------------------------------------------
create table if not exists public.coach_assignments (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  coach_user_id    uuid not null references auth.users(id) on delete cascade,
  learner_user_id  uuid not null references auth.users(id) on delete cascade,
  cohort_id        uuid references public.cohorts(id) on delete set null,
  active_from      date not null default current_date,
  active_to        date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (coach_user_id <> learner_user_id)
);

create index coach_assignments_coach_idx on public.coach_assignments(coach_user_id);
create index coach_assignments_learner_idx on public.coach_assignments(learner_user_id);
create index coach_assignments_org_idx on public.coach_assignments(org_id);

create trigger coach_assignments_set_updated_at
before update on public.coach_assignments
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 7. invitations
-- ---------------------------------------------------------------------
create table if not exists public.invitations (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  email            text not null check (email ~ '^[^@]+@[^@]+\.[^@]+$'),
  role             text not null check (role in ('learner','coach','org_admin')),
  cohort_id        uuid references public.cohorts(id) on delete set null,
  token            text not null unique default encode(gen_random_bytes(32), 'base64url'),
  invited_by       uuid references auth.users(id) on delete set null,
  expires_at       timestamptz not null default now() + interval '14 days',
  consumed_at      timestamptz,
  consumed_by      uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index invitations_org_id_idx on public.invitations(org_id);
create index invitations_email_idx on public.invitations(lower(email));

-- ---------------------------------------------------------------------
-- 8. activity_logs
-- ---------------------------------------------------------------------
create table if not exists public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.organizations(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null,
  action      text not null check (char_length(action) between 1 and 200),
  target_type text,
  target_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index activity_logs_org_idx on public.activity_logs(org_id, created_at desc);
create index activity_logs_user_idx on public.activity_logs(user_id, created_at desc);

-- =====================================================================
-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
-- =====================================================================
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select super_admin from public.profiles where user_id = auth.uid()),
    false
  );
$$;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and org_id = p_org_id
      and status = 'active'
  );
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and org_id = p_org_id
      and role = 'org_admin'
      and status = 'active'
  );
$$;

create or replace function public.is_coach_in_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and org_id = p_org_id
      and role in ('coach','org_admin')
      and status = 'active'
  );
$$;

create or replace function public.is_coach_of(p_learner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coach_assignments
    where coach_user_id = auth.uid()
      and learner_user_id = p_learner
      and (active_to is null or active_to >= current_date)
  );
$$;

-- Redeem an invitation: validates token and returns matching invitation row.
-- Called during signup before the user exists; runs with caller's (anon) rights.
create or replace function public.verify_invitation(p_token text)
returns table (id uuid, org_id uuid, email text, role text, cohort_id uuid, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select id, org_id, email, role, cohort_id, expires_at
  from public.invitations
  where token = p_token
    and consumed_at is null
    and expires_at > now()
  limit 1;
$$;

-- Consume an invitation after the user exists and email matches.
-- Creates the membership row atomically.
create or replace function public.consume_invitation(p_token text)
returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitations%rowtype;
  mem public.memberships%rowtype;
  user_email text;
begin
  select email into user_email from auth.users where id = auth.uid();
  if user_email is null then
    raise exception 'not authenticated';
  end if;

  select * into inv
  from public.invitations
  where token = p_token
    and consumed_at is null
    and expires_at > now()
    and lower(email) = lower(user_email)
  for update;

  if not found then
    raise exception 'invitation invalid, expired, or email mismatch';
  end if;

  insert into public.memberships (org_id, user_id, role, cohort_id, status)
  values (inv.org_id, auth.uid(), inv.role, inv.cohort_id, 'active')
  on conflict (org_id, user_id) do update
    set role = excluded.role,
        cohort_id = excluded.cohort_id,
        status = 'active'
  returning * into mem;

  update public.invitations
    set consumed_at = now(), consumed_by = auth.uid()
    where id = inv.id;

  insert into public.activity_logs (org_id, user_id, action, target_type, target_id, details)
  values (inv.org_id, auth.uid(), 'membership.created_from_invitation', 'membership', mem.id::text,
          jsonb_build_object('role', inv.role, 'invitation_id', inv.id));

  return mem;
end;
$$;

grant execute on function public.verify_invitation(text) to anon, authenticated;
grant execute on function public.consume_invitation(text) to authenticated;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.organizations      enable row level security;
alter table public.profiles           enable row level security;
alter table public.memberships        enable row level security;
alter table public.cohorts            enable row level security;
alter table public.coach_assignments  enable row level security;
alter table public.invitations        enable row level security;
alter table public.activity_logs      enable row level security;

-- organizations ------------------------------------------------------------
create policy "org members can read their orgs"
on public.organizations for select
using (public.is_super_admin() or public.is_org_member(id));

create policy "org_admins can update their org"
on public.organizations for update
using (public.is_super_admin() or public.is_org_admin(id))
with check (public.is_super_admin() or public.is_org_admin(id));

create policy "super_admins can insert orgs"
on public.organizations for insert
with check (public.is_super_admin());

create policy "super_admins can delete orgs"
on public.organizations for delete
using (public.is_super_admin());

-- profiles -----------------------------------------------------------------
create policy "users can read their own profile"
on public.profiles for select
using ((select auth.uid()) = user_id);

create policy "super_admins can read all profiles"
on public.profiles for select
using (public.is_super_admin());

create policy "org members can read other profiles in the same org"
on public.profiles for select
using (
  exists (
    select 1
    from public.memberships m1
    join public.memberships m2 on m1.org_id = m2.org_id
    where m1.user_id = (select auth.uid())
      and m2.user_id = profiles.user_id
      and m1.status = 'active'
      and m2.status = 'active'
  )
);

create policy "users can update their own profile"
on public.profiles for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and super_admin = (select super_admin from public.profiles where user_id = (select auth.uid())));

create policy "super_admins can update any profile"
on public.profiles for update
using (public.is_super_admin())
with check (public.is_super_admin());

-- memberships --------------------------------------------------------------
create policy "users can read their own memberships"
on public.memberships for select
using ((select auth.uid()) = user_id);

create policy "coaches + org_admins can read memberships in their orgs"
on public.memberships for select
using (public.is_super_admin() or public.is_coach_in_org(org_id));

create policy "org_admins + super_admins can insert memberships"
on public.memberships for insert
with check (public.is_super_admin() or public.is_org_admin(org_id));

create policy "org_admins + super_admins can update memberships"
on public.memberships for update
using (public.is_super_admin() or public.is_org_admin(org_id))
with check (public.is_super_admin() or public.is_org_admin(org_id));

create policy "org_admins + super_admins can delete memberships"
on public.memberships for delete
using (public.is_super_admin() or public.is_org_admin(org_id));

-- cohorts ------------------------------------------------------------------
create policy "org members can read their cohorts"
on public.cohorts for select
using (public.is_super_admin() or public.is_org_member(org_id));

create policy "org_admins + super_admins can manage cohorts"
on public.cohorts for all
using (public.is_super_admin() or public.is_org_admin(org_id))
with check (public.is_super_admin() or public.is_org_admin(org_id));

-- coach_assignments --------------------------------------------------------
create policy "coaches and learners read their own assignments"
on public.coach_assignments for select
using (
  public.is_super_admin()
  or (select auth.uid()) = coach_user_id
  or (select auth.uid()) = learner_user_id
  or public.is_org_admin(org_id)
);

create policy "org_admins + super_admins manage coach_assignments"
on public.coach_assignments for all
using (public.is_super_admin() or public.is_org_admin(org_id))
with check (public.is_super_admin() or public.is_org_admin(org_id));

-- invitations --------------------------------------------------------------
create policy "org_admins + super_admins read invitations"
on public.invitations for select
using (public.is_super_admin() or public.is_org_admin(org_id));

create policy "org_admins + super_admins create invitations"
on public.invitations for insert
with check (public.is_super_admin() or public.is_org_admin(org_id));

create policy "org_admins + super_admins update invitations"
on public.invitations for update
using (public.is_super_admin() or public.is_org_admin(org_id))
with check (public.is_super_admin() or public.is_org_admin(org_id));

create policy "org_admins + super_admins delete invitations"
on public.invitations for delete
using (public.is_super_admin() or public.is_org_admin(org_id));

-- activity_logs ------------------------------------------------------------
create policy "org_admins + super_admins read activity_logs"
on public.activity_logs for select
using (
  public.is_super_admin()
  or (org_id is not null and public.is_org_admin(org_id))
  or (select auth.uid()) = user_id
);

create policy "any authenticated user can log their own activity"
on public.activity_logs for insert
with check (
  (select auth.uid()) = user_id
  and (org_id is null or public.is_org_member(org_id))
);
