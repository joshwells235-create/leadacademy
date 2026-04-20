-- LMS Phase C4 — learning paths.
-- A path is a sequenced series of courses. Org-scoped (nullable for
-- super-authored cross-org templates). Assigned to a cohort the same way
-- courses are; assignment auto-materializes individual cohort_courses
-- rows so all existing readers (vitality, due dates from C3, scheduled
-- unlock from C2, lesson gates from C1) keep working unchanged.

create table if not exists public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_paths_org_idx on public.learning_paths (org_id);

create table if not exists public.learning_path_courses (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.learning_paths(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  "order" int not null default 0,
  created_at timestamptz not null default now(),
  unique (path_id, course_id)
);

create index if not exists learning_path_courses_path_idx
  on public.learning_path_courses (path_id);

create table if not exists public.cohort_learning_paths (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  path_id uuid not null references public.learning_paths(id) on delete cascade,
  available_from date,
  due_at date,
  created_at timestamptz not null default now(),
  unique (cohort_id, path_id)
);

create index if not exists cohort_learning_paths_cohort_idx
  on public.cohort_learning_paths (cohort_id);

-- RLS
alter table public.learning_paths enable row level security;
alter table public.learning_path_courses enable row level security;
alter table public.cohort_learning_paths enable row level security;

-- Read: signed-in users can see paths in their org or super-authored
-- (org_id null) paths. Writes: super only.
drop policy if exists "learning_paths_read" on public.learning_paths;
create policy "learning_paths_read"
  on public.learning_paths for select
  to authenticated
  using (
    public.is_super_admin()
    or org_id is null
    or public.is_org_member(org_id)
  );

drop policy if exists "learning_paths_super_write" on public.learning_paths;
create policy "learning_paths_super_write"
  on public.learning_paths for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "learning_path_courses_read" on public.learning_path_courses;
create policy "learning_path_courses_read"
  on public.learning_path_courses for select
  to authenticated
  using (true);

drop policy if exists "learning_path_courses_super_write" on public.learning_path_courses;
create policy "learning_path_courses_super_write"
  on public.learning_path_courses for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "cohort_learning_paths_read" on public.cohort_learning_paths;
create policy "cohort_learning_paths_read"
  on public.cohort_learning_paths for select
  to authenticated
  using (true);

drop policy if exists "cohort_learning_paths_super_write" on public.cohort_learning_paths;
create policy "cohort_learning_paths_super_write"
  on public.cohort_learning_paths for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- updated_at trigger
create or replace function public.touch_learning_paths_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists touch_learning_paths_updated_at_t on public.learning_paths;
create trigger touch_learning_paths_updated_at_t
  before update on public.learning_paths
  for each row execute function public.touch_learning_paths_updated_at();
