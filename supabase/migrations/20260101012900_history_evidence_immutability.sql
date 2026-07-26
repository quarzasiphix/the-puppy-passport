-- Stage XR-6 (append-only queue): immutable history/evidence preservation. Auditing every
-- history/audit-trail-shaped table for a real UPDATE/DELETE policy (transport_status_history and
-- audit_logs were already confirmed fully append-only during Stage XR-3's grant audit) found one
-- real gap: `animal_ownership_history`'s only policy for admins ("admins manage all ownership
-- history") is `for all`, but this table is explicitly provenance/history data (its own comment:
-- "ownership history... this is provenance data, not something a public visitor needs to see") --
-- the same append-only shape as `audit_logs`/`transport_status_history`, just never locked down to
-- match. Split into SELECT only for admins (the table's own comment already states the intended
-- visibility: "visible to the current owner/org and admins only" -- nothing there implies write
-- access was ever meant to be open-ended). No INSERT granted either -- confirmed by grep this
-- table still has zero real writer anywhere in `src/` (Stage Y's original finding, unchanged), so
-- when the real ownership-transfer action is eventually built, it should write through a dedicated
-- SECURITY DEFINER RPC as part of that atomic action, the same pattern every other multi-effect
-- write in this schema already uses, not a raw admin table-insert policy granted speculatively
-- ahead of the feature that would use it.
--
-- Deliberately NOT touching `reports`' own `for all` admin policy despite the superficially similar
-- shape: `tests/db/reports-soft-dismissal.test.ts`'s own header comment makes explicit that Stage
-- CJG considered exactly this and chose to keep raw DELETE capability intentionally ("a report
-- could legitimately need real removal in a rare case, e.g. defamatory content") -- a real,
-- considered design decision already tested and documented, not an overlooked gap. Reading only
-- the migration file's own comment (which focuses on the normal-path fix) without also reading the
-- paired test file's fuller explanation would have led to reverting a deliberate decision; caught
-- before committing by reading both.
drop policy "admins manage all ownership history" on public.animal_ownership_history;

create policy "admins view all ownership history"
  on public.animal_ownership_history for select
  to authenticated
  using (public.is_admin());
