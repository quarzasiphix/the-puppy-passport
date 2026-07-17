-- Part of task #31 / docs/IMPLEMENTATION_PLAN.md #10 and docs/DECISIONS.md: "a legal knowledge
-- base is a real future differentiator, not a v1 requirement. Don't invent country-specific legal
-- rules; a legal_requirements placeholder table (planned, not yet built) is never populated
-- without a source URL + review date." This migration only adds the table/RLS — no rows are
-- seeded, and the schema itself refuses to accept a row without a source and a review date, so it
-- structurally can't be used to publish an invented rule later either.

create type public.legal_requirement_category as enum (
  'transport', 'breeding', 'sales', 'import_export', 'identification', 'other'
);

create table public.legal_requirements (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  category public.legal_requirement_category not null,
  title text not null,
  -- Plain-language summary only — this is a pointer into the source document, never a substitute
  -- legal opinion. The app must never present this as "your transport is compliant"; it only ever
  -- feeds compliance_review_result-style routing/checklists, same as the rest of the compliance
  -- module (see transport_requests.compliance_review_result).
  summary text not null,
  source_url text not null,
  source_name text,
  last_reviewed_at date not null,
  is_published boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_requirements_source_url_check check (source_url ~ '^https?://')
);

create trigger set_legal_requirements_updated_at
  before update on public.legal_requirements
  for each row execute function public.set_updated_at();

alter table public.legal_requirements enable row level security;

create policy "public reads published legal requirements"
  on public.legal_requirements for select
  to anon, authenticated
  using (is_published);

create policy "ops staff manage legal requirements"
  on public.legal_requirements for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());

grant select on public.legal_requirements to anon;
grant select, insert, update, delete on public.legal_requirements to authenticated;
