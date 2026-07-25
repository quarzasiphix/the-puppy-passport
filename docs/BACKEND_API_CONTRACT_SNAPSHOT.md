# Backend API Contract Snapshot

**IR-1 (integration-readiness queue).** A point-in-time record of exactly what the Data API
(PostgREST, via the Supabase JS client) actually exposes today — every table's real
SELECT/INSERT/UPDATE/DELETE grants to `anon`/`authenticated`, every RPC's real signature, and every
public view — queried directly from the live local instance (`information_schema`/`pg_proc`, not
transcribed from migration files or memory), the same "verify against the real repository" standard
this session applies everywhere else. Generated 2026-07-25 against migration
`20260101012200_notification_template_versioning.sql` (124 migration files, post-CJS).

**What this is not**: a permission/authorization matrix (that's `docs/PERMISSION_INVENTORY.md`,
role-first) or an invariant catalogue (`docs/DATABASE_INVARIANTS.md`). This is narrower and
more literal — the exact verb-level surface PostgREST will attempt to evaluate RLS against, before
any row-level policy narrows it further. A `SELECT` grant here does not mean an arbitrary row is
readable; it means the Data API layer doesn't reject the query outright before RLS even runs.

**How to regenerate**: the queries below (adjust table/schema filters as needed) against the local
Postgres instance (`docker exec -i supabase_db_the-puppy-passport psql -U postgres -d postgres`)
reproduce this snapshot exactly. No persisted automation exists yet for this specific stage — a
future drift-detection tool comparing two such snapshots is XR-17's separate, later scope, so as
not to duplicate it here.

```sql
-- Table grants (SELECT/INSERT/UPDATE/DELETE only, anon + authenticated)
select t.table_name,
  string_agg(distinct case when r.grantee='anon' then r.privilege_type end, ',') as anon,
  string_agg(distinct case when r.grantee='authenticated' then r.privilege_type end, ',') as authenticated
from information_schema.tables t
join information_schema.table_privileges r
  on r.table_schema='public' and r.table_name=t.table_name
  and r.grantee in ('anon','authenticated') and r.privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
where t.table_schema='public' and t.table_type='BASE TABLE'
group by t.table_name order by t.table_name;

-- RPCs granted to anon/authenticated, with real signatures
select p.proname, pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid),
  string_agg(distinct r.grantee, ',')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
left join information_schema.routine_privileges r
  on r.routine_schema='public' and r.routine_name=p.proname and r.grantee in ('anon','authenticated')
where n.nspname='public' and p.prokind='f'
group by p.proname, p.oid having string_agg(distinct r.grantee, ',') is not null
order by p.proname;
```

## RPCs (the real callable surface)

Every function below is `SECURITY DEFINER` unless noted, granted `execute` to `authenticated` only
— no RPC in this schema is callable by `anon`. Grouped by domain.

**Identity / verification / organisation membership**
- `approve_user_verification(p_verification_id uuid, p_admin_notes text) → uuid` — admin-only.
- `get_my_profile() → profiles` — includes email/phone (locked out of the `profiles` table grant
  itself, Stage AJ), the one deliberate exception.
- `invite_org_member`, `accept_org_invitation`, `decline_org_invitation`, `revoke_org_invitation`,
  `get_invitation_by_token`, `remove_org_member`, `set_org_member_status`, `change_org_member_role`,
  `leave_organisation` — organisation team management (Stage E/F).
- `require_recent_auth(p_operation text, p_max_age interval) → void` — step-up check (Stage CJN);
  `last_auth_at() → timestamptz` — its underlying helper, also independently callable.

**Transport**
- `create_transport_draft(p_request jsonb, p_animals jsonb, p_parties jsonb) → uuid`
- `change_ops_request_status`, `assign_request_to_route`, `advance_transport_job_status`,
  `request_transport_amendment`, `review_transport_amendment`
- `start_transport_conversation(p_transport_request_id uuid) → uuid`

**Marketplace / applications**
- `start_application_conversation(p_animal_id uuid, p_buyer_id uuid) → uuid`

**Moderation / support / legal**
- `claim_moderation_case`, `submit_moderation_appeal`, `review_moderation_appeal`
- `claim_support_case`
- `place_legal_hold`, `release_legal_hold` — admin-only, step-up gated (Stage CJH/CJN).
- `get_account_deletion_blockers(p_profile_id uuid) → table(blocker text)` — admin-only, read-only.
- `execute_account_deletion(p_request_id uuid) → void` — admin-only, step-up gated.

**Welfare**
- `acknowledge_welfare_case`, `review_welfare_case`, `convert_welfare_case_to_transport_draft`

**Notifications / risk / rate limiting (mostly internal, but directly callable)**
- `create_notification_if_enabled(..., p_dedup_key text, p_template_version integer) → uuid`
  (Stage CJR/CJS's real current signature — 8 params).
- `get_notification_preference(p_profile_id uuid, p_category text) → boolean`
- `mark_risk_signal_reviewed` — ops-staff-only in practice (RLS-gated internally, grant is broader).
- `enforce_rate_limit(p_action_key text, p_max_count integer, p_window interval) → void` —
  genuinely callable with arbitrary args by any authenticated user (used this way throughout this
  session's own test suite); real production call sites always pass a fixed, hardcoded
  `(action_key, max_count, window)` triple, never a client-supplied one.

## Public views (`anon` + `authenticated`, both by design)

| View | Shape |
|---|---|
| `public_transport_requests` | Safe column projection — no exact address, no requester identity beyond what's already public via the linked animal/org. Definer-style (base table has no anon-facing RLS at all; the view *is* the boundary). |
| `public_routes` | Same shape — definer-style. |
| `public_fundraising_contributions` / `public_fundraising_totals` | Supporter identity excluded; definer-style. |
| `public_transport_rating` | Aggregate only. |
| `driver_transport_job_view` | `security_invoker` — relies on the base table's own RLS (assigned-driver-only), only narrows columns. |
| `my_moderation_case_view` | `security_invoker` — relies on `affected_profile_id = auth.uid()`, narrows columns (never `decision_explanation`/`assigned_moderator_id`/`report_id`). |

See Stage CJB's own column-by-column audit (`docs/AUTONOMOUS_BACKEND_PROGRESS.md`) for the full
privacy verification of each; not repeated here.

## Table grants (SELECT / INSERT / UPDATE / DELETE only)

`anon` column blank = no direct table access at all (either fully private, or — for several —
exposed only through one of the public views above). Every table has RLS enabled; a grant here is
necessary but never sufficient for access to any given row.

| Table | anon | authenticated |
|---|---|---|
| account_deletion_requests | — | D,I,S,U |
| achievements | S | D,I,S,U |
| animal_images | S | D,I,S,U |
| animal_ownership_history | — | D,I,S,U |
| animals | S | D,I,S,U |
| app_maintenance_mode | S | S,U |
| audit_logs | — | D,I,S,U *(grant only — no RLS policy permits any of these for non-admins; see `docs/DATABASE_INVARIANTS.md`)* |
| breeds | S | D,I,S,U |
| buyer_applications | — | D,I,S,U |
| comments | S | D,I,S,U |
| compliance_reviews | — | D,I,S,U |
| conversation_participants | — | D,I,S,U |
| conversations | — | D,I,S,U |
| drivers | — | D,I,S,U |
| follows | — | D,I,S,U |
| fundraising_campaigns | S | D,I,S,U |
| fundraising_contributions | — | D,I,S,U |
| group_members | S | D,I,S,U |
| groups | S | D,I,S,U |
| handover_protocols | — | D,I,S,U |
| legal_document_versions | S | D,I,S,U |
| legal_holds | — | I,S,U *(no DELETE grant — holds are only ever marked released, never deleted, Stage CJH)* |
| legal_requirements | S | D,I,S,U |
| litters | S | D,I,S,U |
| markets | S | D,I,S,U |
| messages | — | D,I,S,U *(grant only — no UPDATE/DELETE RLS policy for anyone, immutable history, Stage CJF's own precedent predates this table; see invariants doc)* |
| moderation_appeals | — | S *(creation is exclusively via `submit_moderation_appeal()`, Stage G)* |
| moderation_cases | — | D,I,S,U |
| notification_preferences | — | D,I,S,U |
| notifications | — | D,I,S,U |
| organisation_invitations | — | I,S,U |
| organisation_members | — | D,I,S,U |
| organisations | S | D,I,S,U |
| parent_dogs | S | D,I,S,U |
| posts | S | D,I,S,U |
| pricing_rules | S | D,I,S,U |
| private_addresses | — | D,I,S,U |
| product_service_categories | S | D,I,S,U |
| profiles | — | D,I,U *(no SELECT grant — public columns are read only via the anon-facing view/RLS policy shape from Stage AJ/3100, never a raw broad SELECT)* |
| quotations | — | D,I,S,U |
| rate_limit_events | — | S *(insert/delete only ever happen inside `enforce_rate_limit()` itself, running with definer privileges, not the caller's own grant)* |
| reactions | S | D,I,S,U |
| rehoming_reviews | S | D,I,S,U |
| reports | — | D,I,S,U |
| reservations | — | D,I,S,U |
| risk_signals | — | S *(staff-only via RLS; no client INSERT/UPDATE/DELETE path exists at all, Stage BN)* |
| route_assignments | — | D,I,S,U |
| route_stops | — | D,I,S,U |
| route_waitlist | — | D,I,S,U |
| routes | — | D,I,S,U |
| saved_animals | — | D,I,S,U |
| saved_posts | — | D,I,S,U |
| species | S | D,I,S,U |
| support_case_messages | — | I,S |
| support_cases | — | D,I,S,U |
| transport_documents | — | D,I,S,U |
| transport_incidents | — | D,I,S,U |
| transport_operator_authorisations | S | D,I,S,U |
| transport_parties | — | D,I,S,U |
| transport_request_amendments | — | D,I,S,U |
| transport_request_animals | — | D,I,S,U |
| transport_requests | — | D,I,S,U |
| transport_reviews | — | D,I,S,U |
| transport_status_history | — | I,S *(no UPDATE/DELETE grant — immutable, Stage CJF)* |
| user_consents | — | D,I,S,U |
| user_roles | — | D,I,S,U |
| user_verifications | — | D,I,S,U |
| vehicles | — | D,I,S,U |
| welfare_case_documents | — | D,I,S,U |
| welfare_cases | — | I,S,U |

## Notes for whoever integrates the frozen frontend branch

- Every RPC name/argument above is what the frontend must call verbatim — a mismatched argument
  name (not just type) fails outright, PostgREST does not do positional fallback.
- `create_notification_if_enabled` gained two new trailing optional params this session
  (`p_dedup_key`, `p_template_version`, Stage CJR/CJS) — any frontend code calling it with only the
  original 6 still works unchanged (both new params default to `null`).
- Tables with a blank `anon` column but a real public view (`transport_requests`→
  `public_transport_requests`, etc.) mean: don't query the base table directly for public/anonymous
  reads, use the view.
- `src/lib/supabase/types.ts` is a hand-written stub (not generated) — cross-referenced against this
  snapshot's real RPC list (`comm` against the two name lists, not eyeballed) during this stage.
  Found and fixed a real gap: `require_recent_auth`/`last_auth_at` (Stage CJN) were granted to
  `authenticated` but never added to the stub — neither is called from `src/` app code today (both
  are used internally by other SECURITY DEFINER functions, not called directly by the client), so
  this wasn't a live bug, but it was a real, demonstrated staleness matching this exact grant
  surface, not a hypothetical one. Fixed by adding both entries, matching the existing convention of
  stubbing every granted RPC regardless of whether app code calls it directly yet (`enforce_rate_limit`
  was already stubbed on the same basis). Full enum-fidelity reconciliation (enum-typed params
  widened to plain `string` in the stub) is real but stays IR-5's separate, later scope.
