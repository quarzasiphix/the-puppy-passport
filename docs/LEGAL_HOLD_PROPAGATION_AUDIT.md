# Legal-hold propagation audit

Stage XR-16 (append-only queue). Revalidates Stage CJH's legal-hold mechanism per this stage's own
explicit precedence ("overlaps CJH — treated as a revalidation pass if still needed, not a
duplicate build"), rather than rebuilding it.

## Already correct — confirmed, not rebuilt

- **Blocks deletion/anonymisation**: `execute_account_deletion()` already refuses while an active
  legal hold exists (`legal_holds where subject_profile_id = ... and released_at is null`),
  already thoroughly tested (`tests/db/legal-holds.test.ts`, `tests/db/deletion-blocker-graph.test.ts`).
- **Never hard-deleted**: a released hold is marked `released_at`/`released_by`, the row itself
  survives forever — matching the same "never destroy something with audit value" discipline as
  every other history table this session has locked down.
- **Admin-only in both directions**: gated to `is_admin()` specifically (not the broader
  `is_ops_staff()`), a deliberately higher bar than most other admin actions.
- **Actor already server-stamped**: `placed_by`/`released_by` are always `auth.uid()`, never
  client-forgeable.

## Found and fixed: hold transitions were never actually audited

`place_legal_hold()`/`release_legal_hold()` — this stage's own "restrict and *audit* hold
transitions" requirement, checked literally — never wrote a single `audit_logs` entry. Every other
comparably consequential admin action in this schema does (moderation decisions, welfare case
reviews, account deletion execution, verification approvals); a legal hold overrides someone's
ability to have their own account deleted at all, tied to litigation/investigation/regulatory need
— among the most consequential admin actions this schema has, yet it left no trace in the one
ledger ops/admin actually review together (`dashboard.admin.audit-logs.tsx`). The `legal_holds`
table itself still correctly records `placed_by`/`released_by` (a narrower, hold-specific record,
unchanged) — this was a real gap in the *general* audit trail specifically, not a loss of
attribution.

Fixed in `20260101013300_legal_hold_audit_trail.sql`: both RPCs now insert a real `audit_logs`
entry (`legal_hold.placed`/`legal_hold.released`, `target_type: 'profiles'`, the real subject
profile id, and the hold id/reason in `after`). New tests in `tests/db/legal-holds.test.ts` prove
both transitions land as real, separate, correctly-attributed audit entries.

## "Archival" and "Storage cleanup" — no real gap found

Checked whether any real Storage-object deletion path or archival job should but doesn't check
legal holds before removing a held person's data. Confirmed (matching Stage BV's earlier finding,
still true) that no real "delete this document/photo" feature exists anywhere in the app yet — no
code path today ever deletes a Storage object belonging to a person, held or not. Nothing to
propagate a check into until that feature itself is built; a speculative check now would guard a
deletion path that can't currently be reached.
