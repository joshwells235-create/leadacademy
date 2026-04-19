-- LMS Phase C1 — lesson + course prerequisites with cycle prevention.
-- Junction tables let an author require completion of other lessons (within
-- the same course) or other courses before a learner can open a target.
-- Cycle prevention is enforced server-side via a recursive-CTE trigger so
-- the author UI can stay simple (multi-select with the obvious options
-- pre-filtered).

create table if not exists public.lesson_prerequisites (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  required_lesson_id uuid not null references public.lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (lesson_id, required_lesson_id),
  check (lesson_id <> required_lesson_id)
);

create index if not exists lesson_prerequisites_lesson_idx
  on public.lesson_prerequisites (lesson_id);
create index if not exists lesson_prerequisites_required_idx
  on public.lesson_prerequisites (required_lesson_id);

create table if not exists public.course_prerequisites (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  required_course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (course_id, required_course_id),
  check (course_id <> required_course_id)
);

create index if not exists course_prerequisites_course_idx
  on public.course_prerequisites (course_id);
create index if not exists course_prerequisites_required_idx
  on public.course_prerequisites (required_course_id);

-- Cycle prevention: walk the prereq graph from the proposed required edge
-- and raise if the dependent target is reachable. Runs on insert + update.
create or replace function public.lesson_prereq_no_cycle()
returns trigger
language plpgsql
as $$
begin
  if exists (
    with recursive walk(node) as (
      select new.required_lesson_id
      union
      select lp.required_lesson_id
        from public.lesson_prerequisites lp
        join walk on walk.node = lp.lesson_id
    )
    select 1 from walk where node = new.lesson_id
  ) then
    raise exception 'lesson_prerequisites cycle: % cannot require %',
      new.lesson_id, new.required_lesson_id;
  end if;
  return new;
end
$$;

drop trigger if exists lesson_prereq_no_cycle_t on public.lesson_prerequisites;
create trigger lesson_prereq_no_cycle_t
  before insert or update on public.lesson_prerequisites
  for each row execute function public.lesson_prereq_no_cycle();

create or replace function public.course_prereq_no_cycle()
returns trigger
language plpgsql
as $$
begin
  if exists (
    with recursive walk(node) as (
      select new.required_course_id
      union
      select cp.required_course_id
        from public.course_prerequisites cp
        join walk on walk.node = cp.course_id
    )
    select 1 from walk where node = new.course_id
  ) then
    raise exception 'course_prerequisites cycle: % cannot require %',
      new.course_id, new.required_course_id;
  end if;
  return new;
end
$$;

drop trigger if exists course_prereq_no_cycle_t on public.course_prerequisites;
create trigger course_prereq_no_cycle_t
  before insert or update on public.course_prerequisites
  for each row execute function public.course_prereq_no_cycle();

-- RLS: signed-in users read; super_admin writes.
alter table public.lesson_prerequisites enable row level security;
alter table public.course_prerequisites enable row level security;

drop policy if exists "lesson_prereqs_read" on public.lesson_prerequisites;
create policy "lesson_prereqs_read"
  on public.lesson_prerequisites for select
  to authenticated
  using (true);

drop policy if exists "lesson_prereqs_super_write" on public.lesson_prerequisites;
create policy "lesson_prereqs_super_write"
  on public.lesson_prerequisites for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "course_prereqs_read" on public.course_prerequisites;
create policy "course_prereqs_read"
  on public.course_prerequisites for select
  to authenticated
  using (true);

drop policy if exists "course_prereqs_super_write" on public.course_prerequisites;
create policy "course_prereqs_super_write"
  on public.course_prerequisites for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
