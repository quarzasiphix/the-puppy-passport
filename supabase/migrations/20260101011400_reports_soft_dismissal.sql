-- Stage CJG (third/fourth supplemental queue): soft-deletion/archival semantics. Audited every
-- table for a consistent soft-delete/archival pattern: `profiles` already has real soft-deletion
-- (`execute_account_deletion()`, Stage AI), organisations use suspend/restore rather than delete
-- (Stage I), animals use status transitions (`withdrawn`) rather than delete, and every real
-- `.delete()` call elsewhere in `src/lib/queries/*.ts` targets genuinely ephemeral records (junction
-- tables like `follows`/`saved_animals`/`reactions`, or draft-only rows before submission) with no
-- audit value. One real inconsistency found: `dismissReport()` hard-deletes a `reports` row —
-- permanently destroying evidence that could matter for detecting a real abuse pattern (the same
-- "repeated reports from one reporter" signal `risk_signals.multiple_independent_reports`, Stage
-- BN, was already deliberately left unwired for exactly this kind of future need). `reports` had
-- no status column at all, so dismissing genuinely meant "this row can never be referenced again."
create type public.report_status as enum ('open', 'dismissed', 'escalated');

alter table public.reports add column status public.report_status not null default 'open';
