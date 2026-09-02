-- Phase 12 (legal and trust readiness, docs/IMPLEMENTATION_PLAN.md): extends the existing
-- legal_requirements table (20260101003500_legal_requirements.sql, already correctly built —
-- never populated without a source URL + review date) with the remaining fields real "country-
-- and species-specific rule packs" need: species scope, a distinct effective date (vs. the date
-- someone last reviewed the row), a named reviewer, and whether the rule is advisory or actually
-- blocking. Purely additive — no existing behaviour changes, no rows are seeded (same "never
-- invent a legal rule" discipline as the original migration).

create type public.legal_requirement_enforcement as enum ('advisory', 'blocking');

alter table public.legal_requirements
  add column species_id uuid references public.species (id),
  add column effective_date date,
  add column reviewer_id uuid references public.profiles (id),
  add column enforcement_level public.legal_requirement_enforcement not null default 'advisory';

comment on column public.legal_requirements.species_id is
  'Null means the rule applies across all species (e.g. a general transport document rule); set for a species-specific rule (e.g. a prohibited-species import restriction).';
comment on column public.legal_requirements.effective_date is
  'When the underlying legal rule itself takes effect — distinct from last_reviewed_at, which tracks when Anemalo staff last checked the source is still current.';
comment on column public.legal_requirements.reviewer_id is
  'The staff member who actually reviewed this rule against its source, distinct from created_by (who entered the row).';
comment on column public.legal_requirements.enforcement_level is
  'blocking = this rule should stop a listing/request/transport from proceeding until resolved; advisory = shown as guidance only. Still never a substitute legal opinion — see the summary column''s existing comment.';
