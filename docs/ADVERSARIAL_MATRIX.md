# Final adversarial matrix (Stage XR-23)

## Method

By this stage the backend exposes 34 public RPCs (`docs/backend-api-contract-baseline.json`,
Stage XR-18), and `tests/db/` already has 63 files of real, live adversarial testing against nearly
all of them — most privileged RPCs already have dedicated cross-tenant/non-owner rejection tests
(role suspension, cross-organisation isolation, actor-forgery, protected-field mutation, etc.,
built across dozens of earlier stages). Rather than re-describing that existing coverage as a fresh
"matrix," the actually valuable, non-duplicative thing this stage could do is find real,
*currently-untested* privilege-relevant surface — a systematic sweep, not a sample.

Cross-referenced every one of the 34 RPCs in the contract baseline against every `tests/db/*.ts`
call site (`grep -rl "\"<rpc_name>\"" tests/db/*.ts`). **32 of 34 already had at least one test
referencing them.** Two had zero:

- `change_org_member_role(p_member_id, p_new_role)`
- `decline_org_invitation(p_token)`

A third, `last_auth_at()`, also came up with zero test references but was checked and ruled out as
a real gap: it's `security invoker` (not `definer`), takes no parameters, and only ever reads the
calling session's own JWT `amr` claim — there is no other-user, other-org, or privilege-escalation
surface to attack, and it's already exercised indirectly through `require_recent_auth()` (which
does have direct test coverage in `tests/db/recent-auth-step-up.test.ts`).

## The two real gaps

Both RPCs are real, live, currently-wired (`supabase/migrations/20260101007700_organisation_team_management.sql`),
and reading their definitions found the underlying logic already correct — this closes a coverage
gap, not a code bug, but the gap mattered: `change_org_member_role()` in particular carries genuine
self-escalation-prevention logic (an administrator cannot promote themselves or a peer to
owner/administrator; only the true owner may touch an owner/administrator-tier row) that had never
actually been exercised by a test. A regression there — someone tightening or loosening that `if`
condition later without a test catching it — would have gone completely unnoticed.

New tests added to `tests/db/organisation-team.test.ts` (same file as the rest of this RPC's
subsystem, not a new fragmented file):

**`change_org_member_role`**: a non-manager has no capability at all; an administrator cannot
escalate themselves to owner; an administrator cannot promote a volunteer straight to
administrator; an administrator *can* move someone between two non-privileged tiers (the
legitimate case, proving the block is precisely scoped, not blanket); only the true owner can
touch an administrator-tier row's role at all.

**`decline_org_invitation`**: a wrong-email user cannot decline someone else's invitation (the
invitation stays untouched, still pending); a bogus/nonexistent token is rejected outright; the
correct-email invitee can decline it, producing a real `audit_logs` entry attributed to them; the
same token cannot be declined a second time once already declined.

## Verification

- `npx tsc --noEmit` — clean.
- `npx eslint tests/db/organisation-team.test.ts` — clean.
- Ran the file in isolation first: found and fixed a real test bug of its own (querying
  `audit_logs` as the org owner instead of admin — RLS correctly restricts `audit_logs` reads to
  admin/ops, not org owners, so the assertion was hitting a real permission wall, not a bug in the
  RPC under test). Fixed by reading as `admin`, matching every other `audit_logs` assertion
  elsewhere in the suite (e.g. `tests/db/access-control.test.ts`).
- Full `npm run test:db`: 905/905 (+14 from XR-22's 891, one `test()`/`t.test()` per assertion
  block above, counted individually by the runner), verified on a fresh reset plus one more run
  without reset.
- `npm run build`/`db:preflight` clean, 135 migrations unchanged, no duplicate prefixes.

No migration this stage — the underlying RPC logic needed no change, only its test coverage.
