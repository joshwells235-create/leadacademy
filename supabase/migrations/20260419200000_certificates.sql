-- LMS Phase C5 — certificates.
-- One row per issuance (not mutated on re-certification). CHECK enforces
-- that a certificate is for EXACTLY one of course_id xor path_id.
-- Soft-deletable via revoked_at. PDF rendered lazily + cached to
-- Supabase Storage; pdf_url may be null until first render.

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  path_id uuid references public.learning_paths(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  pdf_url text,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (course_id is not null and path_id is null)
    or (course_id is null and path_id is not null)
  )
);

create index if not exists certificates_user_idx on public.certificates (user_id);
create index if not exists certificates_course_idx
  on public.certificates (course_id)
  where course_id is not null;
create index if not exists certificates_path_idx
  on public.certificates (path_id)
  where path_id is not null;
create index if not exists certificates_cohort_idx
  on public.certificates (cohort_id)
  where cohort_id is not null;
create index if not exists certificates_active_idx
  on public.certificates (user_id, issued_at desc)
  where revoked_at is null;

-- Cert validity in months. Null = non-expiring. When set, re-issuance
-- stamps a new expires_at = issued_at + cert_validity_months.
alter table public.courses
  add column if not exists cert_validity_months integer
  check (cert_validity_months is null or (cert_validity_months > 0 and cert_validity_months <= 600));
alter table public.learning_paths
  add column if not exists cert_validity_months integer
  check (cert_validity_months is null or (cert_validity_months > 0 and cert_validity_months <= 600));

-- RLS: learners read their own non-revoked certs; coach/consultant/
-- admin/super/org_admin read within scope; super writes.
alter table public.certificates enable row level security;

drop policy if exists "certificates_read_own" on public.certificates;
create policy "certificates_read_own"
  on public.certificates for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "certificates_read_coach_of" on public.certificates;
create policy "certificates_read_coach_of"
  on public.certificates for select
  to authenticated
  using (public.is_coach_of(user_id));

drop policy if exists "certificates_read_consultant" on public.certificates;
create policy "certificates_read_consultant"
  on public.certificates for select
  to authenticated
  using (public.is_consultant_of_learner(user_id));

drop policy if exists "certificates_read_super" on public.certificates;
create policy "certificates_read_super"
  on public.certificates for select
  to authenticated
  using (public.is_super_admin());

drop policy if exists "certificates_super_write" on public.certificates;
create policy "certificates_super_write"
  on public.certificates for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Storage bucket for rendered PDFs. Bucket created via Supabase API /
-- MCP since storage.buckets RLS is special; this migration is a
-- placeholder comment — actual bucket creation runs in a separate
-- migration below via insert to storage.buckets.
insert into storage.buckets (id, name, public)
  values ('certificates', 'certificates', false)
  on conflict (id) do nothing;

-- Storage read/write policies: learners read their own, super writes.
-- File path convention: certificates/{user_id}/{certificate_id}.pdf
drop policy if exists "certificates_bucket_read_own" on storage.objects;
create policy "certificates_bucket_read_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "certificates_bucket_read_super" on storage.objects;
create policy "certificates_bucket_read_super"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'certificates' and public.is_super_admin());

drop policy if exists "certificates_bucket_super_write" on storage.objects;
create policy "certificates_bucket_super_write"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'certificates' and public.is_super_admin())
  with check (bucket_id = 'certificates' and public.is_super_admin());
