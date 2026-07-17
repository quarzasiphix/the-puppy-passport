create type public.report_target_type as enum ('animal_listing', 'organisation', 'post', 'message', 'user');
create type public.report_reason as enum (
  'suspected_illegal_breeding', 'false_breeder_information', 'stolen_animal',
  'missing_or_false_microchip', 'animal_welfare_concern', 'misleading_health_information',
  'scam_or_payment_fraud', 'duplicate_listing', 'prohibited_content', 'other'
);
create type public.moderation_case_status as enum ('open', 'investigating', 'resolved', 'dismissed');
create type public.appeal_status as enum ('none', 'requested', 'reviewed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid not null references public.profiles (id),
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason public.report_reason not null,
  evidence_url text,
  description text,
  created_at timestamptz not null default now()
);

create table public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports (id),
  case_type text not null,
  target_type public.report_target_type not null,
  target_id uuid not null,
  status public.moderation_case_status not null default 'open',
  assigned_moderator_id uuid references public.profiles (id),
  decision text,
  decision_explanation text,
  appeal_status public.appeal_status not null default 'none',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.reports enable row level security;
alter table public.moderation_cases enable row level security;

create policy "reporters view their own reports"
  on public.reports for select
  to authenticated
  using (reporter_profile_id = (select auth.uid()));

create policy "authenticated users can file a report"
  on public.reports for insert
  to authenticated
  with check (reporter_profile_id = (select auth.uid()));

create policy "moderators and admins manage all reports"
  on public.reports for all
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- Moderation cases (and especially decision_explanation) are never public — "do not publicly show
-- administrator notes" applies to reports/moderation the same way it does to breeder review notes.
create policy "moderators and admins manage all moderation cases"
  on public.moderation_cases for all
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());
