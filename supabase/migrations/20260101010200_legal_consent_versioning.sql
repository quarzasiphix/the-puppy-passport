-- Stage BK (supplemental queue): legal-document/consent versioning. The signup page
-- (_public.signup.tsx) already says "By creating an account, you agree to Havenpaw's Terms and
-- Privacy" -- but nothing anywhere records that a specific user actually consented to a specific
-- version of either document. This makes that promise real and auditable, without inventing new
-- UI: the signup server action (src/lib/auth/actions.ts, not a frontend-owned file) already runs
-- entirely server-side, so recording consent to the current version at the moment of signup is a
-- safe, additive change matching the copy that's already there.
--
-- Deliberately does not claim the underlying legal text is final -- /terms and /privacy are
-- explicitly still draft/pending lawyer review (docs/PRODUCTION_READINESS_REPORT.md). The
-- versioning mechanism is real and works the same regardless of whether the content behind a
-- version is a draft or final text; the seeded "current" version is honestly labelled
-- "-draft" to match that reality, and re-consent for a real future version is the same mechanism
-- (publish a new is_current row, the next signup/re-consent picks it up), not something invented
-- speculatively here. Cookie consent is deliberately not auto-recorded at signup (it's normally a
-- separate, later UX moment like a banner, not a signup-time fact) -- the schema supports it, but
-- nothing forces it into the signup flow.
create type public.legal_document_type as enum ('terms', 'privacy', 'cookies');

create table public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_type public.legal_document_type not null,
  version text not null,
  published_at timestamptz not null default now(),
  is_current boolean not null default false,
  unique (document_type, version)
);

-- Only one "current" version per document type at a time -- publishing a new current version is
-- an admin action (below), not something that can accidentally leave two versions both current.
create unique index legal_document_versions_one_current
  on public.legal_document_versions (document_type)
  where is_current;

alter table public.legal_document_versions enable row level security;

create policy "legal document versions are publicly readable"
  on public.legal_document_versions for select
  to anon, authenticated
  using (true);

create policy "admins manage legal document versions"
  on public.legal_document_versions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.legal_document_versions to anon;
grant select, insert, update, delete on public.legal_document_versions to authenticated;

create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  document_type public.legal_document_type not null,
  version text not null,
  consented_at timestamptz not null default now(),
  unique (profile_id, document_type, version)
);

alter table public.user_consents enable row level security;

create policy "users view their own consent history"
  on public.user_consents for select
  to authenticated
  using (profile_id = (select auth.uid()));

-- Append-only: no UPDATE/DELETE policy for ordinary users at all -- a user's consent history is
-- immutable evidence of what they actually agreed to and when, matching the "immutable lifecycle
-- history" reasoning used elsewhere this session. Users can only record consent to a version that
-- is genuinely the current published one for that document type, never an arbitrary string.
create policy "users record consent to a real current document version"
  on public.user_consents for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.legal_document_versions v
      where v.document_type = user_consents.document_type
        and v.version = user_consents.version
        and v.is_current = true
    )
  );

create policy "admins manage all consent records"
  on public.user_consents for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Same auto_expose_new_tables=false gotcha documented in 20260101002900_table_grants.sql and
-- re-found for transport_request_animals/rate_limit_events: RLS policies alone don't make an
-- operation reachable via the Data API, a table-level GRANT is also required. Found here by
-- actually testing admin's delete via the real REST path, not just reading the policy SQL --
-- "admins manage all consent records" is a real FOR ALL policy, but without the UPDATE/DELETE
-- grants it was unreachable for exactly those two operations regardless of RLS.
grant select, insert, update, delete on public.user_consents to authenticated;

insert into public.legal_document_versions (document_type, version, is_current) values
  ('terms', '2026-07-24-draft', true),
  ('privacy', '2026-07-24-draft', true),
  ('cookies', '2026-07-24-draft', true);
