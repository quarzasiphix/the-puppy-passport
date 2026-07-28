# Bot 1 — Overnight Candidate Fix Ledger

This pass created **zero new candidate-fix branches** — the two existing ones (from the finalisation
pass) were re-verified for staleness against `ac612690` and found still correct in content, so
duplicating them here would add no value. Both live only in
`/p/the-puppy-passport-bot1-finalisation-20260727-235034`, branch
`candidate-fixes/bot1-legal-hold-deletion-raw-write-20260727`, never merged/pushed/applied to any
database, never copied into this clone.

| Branch/commit | Finding | Re-verified this pass | Result |
|---|---|---|---|
| `7ba7b32` | H-1/§5.2 (`account_deletion_requests`/`legal_holds` raw-write bypass) | Yes — content re-checked against this pass's own live `pg_policies` read for the same table | Content still correct. **Real filename collision** re-confirmed: `supabase/migrations/20260101013600_admin_command_audit_coverage.sql` exists on real `main` at this exact prefix (confirmed by direct `ls` in this clone) — needs renumbering before use |
| `3f4db66` | H-5/NEW-H3 (`achievements.verification_status` self-verification) | Yes — content re-checked against this pass's own live `pg_policies` read for the same table | Content still correct, no collision, safe to apply as a file pending Bot 2's own testing |

**Recommendation unchanged from prior passes**: Bot 2 should apply `3f4db66` as-is, and apply
`7ba7b32` only after renumbering its migration filename to a currently-unused prefix.
