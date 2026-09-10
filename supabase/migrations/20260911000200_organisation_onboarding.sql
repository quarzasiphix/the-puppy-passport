-- Breeder-panel onboarding (welcome modal + "getting started" checklist). One flag: whether the
-- kennel owner has dismissed the first-visit welcome modal. Nullable/unset = show it; set once and
-- never shown again. No new table needed — the "getting started" checklist itself is derived live
-- from existing data (does this kennel have a parent dog / litter / puppy / brand color yet?), not
-- tracked separately, so it never drifts from reality.
alter table public.organisations
  add column onboarding_completed_at timestamptz;

comment on column public.organisations.onboarding_completed_at is
  'Set once the kennel owner dismisses the first-visit breeder-panel welcome modal. Null = not yet shown/dismissed.';
