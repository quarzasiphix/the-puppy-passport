# Bot 1 — Overnight Adversarial Ledger

One row per attempted attack this pass. Method: live, read-only Postgres catalog introspection
against the idle local Supabase instance (`docker exec supabase_db_the-puppy-passport psql`) —
reading actual effective RLS policies, grants, and function/trigger bodies, which is equivalent to
confirming an attack is *reachable* (the mechanism a real attacker would use is directly visible in
the live catalog) without performing a literal authenticated PostgREST call. No destructive/stateful
action was taken against the shared instance. Source snapshot `ac612690`.

| # | Attack | Actor | Result | Evidence |
|---|---|---|---|---|
| 1 | Raw `PATCH account_deletion_requests` own row, arbitrary column | authenticated, own row | **Reachable** | `pg_policies`: self ALL policy, no column restriction |
| 2 | Raw RPC-call `create_notification_if_enabled()` with arbitrary `p_profile_id` | any authenticated | **Reachable** | `pg_proc.proacl`: direct `authenticated` EXECUTE grant on a `SECURITY DEFINER` function |
| 3 | Raw `PATCH moderation_cases` on a case the actor is conflicted in | any moderator | **Reachable** | `pg_policies`: `is_moderator()` ALL policy, no self-conflict exclusion |
| 4 | Raw `PATCH transport_requests.status: quotation_sent -> accepted_by_customer` | requester, own row | **Reachable** | RLS self-update policy + trigger body's explicit exemption clause, both read live |
| 5 | Raw `PATCH achievements.verification_status -> approved` | org owner, own achievement | **Reachable** | `pg_policies`: `owns_org()` ALL policy, no column restriction |
| 6 | Forge `user_consents` row for a non-current/arbitrary version string | authenticated, own profile | **Blocked** | Migration text: INSERT `WITH CHECK` requires the version to match a real `is_current=true` row |
| 7 | Mutate/delete an existing `user_consents` row | authenticated, own row | **Blocked** | No UPDATE/DELETE policy exists for that role on that table at all |
| 8 | Publish a forged "current" legal document version as non-admin | authenticated, non-admin | **Blocked** | `legal_document_versions` ALL policy requires `is_admin()`; SELECT-only policy for others |
| 9 | Cross-reference: does the account-deletion self-policy's admin sibling also allow raw-forcing `status='processed'`? | admin actor | **Not independently distinguished this pass** | Only the *self-service* clause was traced to a concrete bypass this pass; the admin-policy nuance is carried forward from prior passes' evidence (candidate fix `7ba7b32`'s own commit message describes it), not independently re-derived here |

**Net this pass: 5 reachable (all pre-existing High findings, now on a 3rd independent evidence
method), 3 blocked (all in the consent-versioning surface, genuinely well-built), 1 not
independently distinguished.** No new vulnerability class found. Full attack detail across the whole
lineage (25-row table): `/p/the-puppy-passport-bot1-fullday-20260728-071725/docs/BOT1_ADVERSARIAL_TEST_LEDGER.md`.
