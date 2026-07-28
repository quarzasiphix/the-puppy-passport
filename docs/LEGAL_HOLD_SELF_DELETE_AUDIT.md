# Legal-hold enforcement completeness (Stage FA-4)

## The real gap found

`legal_holds` (`20260101011500_legal_holds.sql`) was built to "preserve a specific account's data
regardless of what business state it's in," but the mechanism was only ever wired into one place:
`execute_account_deletion()`. A profile under an active hold could still freely destroy its own
content one piece at a time through ordinary self-service RLS delete policies that had no idea
legal holds existed:

- `"authors delete their own comments"` (`20260101001900_community.sql`) — any comment, any age,
  no restriction at all.
- `"buyers delete their own applications"` (`20260101013700_suspended_org_application_lock.sql`) —
  any application, at any status (not just a draft), a real hard delete with no audit trail.

**Confirmed genuinely reachable, not hypothetical**: neither policy has any status or age
condition, so a subject placed under investigation could delete every comment or application tied
to their account the instant a hold is placed, and nothing in the schema would stop them — the
exact class of self-initiated destruction the hold mechanism exists to prevent.

## What was deliberately left alone

- **`"requesters delete their own draft requests"`** (transport_requests) — draft, never-submitted
  content with no real evidentiary weight yet; not touched.
- **Org-scoped deletes** (`welfare_case_documents`, kennel media in Storage) — `legal_holds.
  subject_profile_id` names an individual profile, not an organisation, and this schema has no
  established concept of an org-level hold. Extending to org-scoped tables would be speculative,
  not a demonstrated gap — matches this session's "don't manufacture architecture to have
  something to change" discipline.

## What changed

New migration `20260101014200_legal_hold_self_delete_lock.sql`:

- `is_profile_under_legal_hold(p_profile_id uuid)` — a small `SECURITY DEFINER` helper (the two
  existing call sites in `execute_account_deletion()`/`get_account_deletion_blockers()` each
  inline the same `exists(...)` check; this one is for the two new trigger call sites, not a
  retrofit of the existing ones).
- Two `BEFORE DELETE` triggers, `prevent_comment_self_delete_under_legal_hold` and
  `prevent_application_self_delete_under_legal_hold`, each checking the row's own author/buyer.

**No admin exemption, matching `execute_account_deletion()`'s own established precedent**: that
function's legal-hold check runs *after* its own admin-only gate and blocks even the calling
admin — the real-world point of a hold is to stop the underlying destructive action regardless of
who attempts it, not just stop the account holder. Comment moderation (`"admins manage all
comments"`) and admin/ops management of `buyer_applications` are separate, already-audited
policies this migration does not touch in general, but they *are* subject to the new triggers when
the specific row's author is under an active hold — proven directly by a dedicated test ("even an
admin cannot delete the comment while the hold is active").

## Verification

- `npx prettier --write` + `npx eslint` on the changed test file — clean.
- New test in `tests/db/legal-holds.test.ts`: a disposable account creates a comment + application,
  proves deletion works normally before any hold, places a hold, proves both deletes are now
  blocked (for the account itself *and* for an admin), releases the hold, proves deletion works
  again.
- `node --test tests/db/legal-holds.test.ts` in isolation — 23/23 passing.
- Fresh `npm run db:reset`, then `npm run test:db` twice — **1024/1024** both times (+9 from the
  previous 1015 baseline).
- `npx tsc --noEmit` — clean (migration + tests only, no app code).
- `npm run build` — succeeds.
- `npm run db:preflight` — 144 migrations, no unsafe patterns.
- `npm run db:contract-check` — baseline regenerated deliberately (`node scripts/
  contract-drift-check.mjs --write`) to include the new `is_profile_under_legal_hold` RPC; 70
  tables, 42 RPCs, no unreviewed drift.
- No duplicate migration prefixes. `git status --short` shows only the intended changed files.
