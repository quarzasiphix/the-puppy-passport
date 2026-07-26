# Grant / Data API exposure audit

Stage XR-3 (append-only queue). RLS and table-level GRANTs are two independent gates PostgREST
enforces — a GRANT with no matching RLS policy makes a table effectively unreachable ("will 403 on
every real client call," the gap `db:preflight`'s check 1 already catches, Stage CA); the mirror
image — a GRANT *broader* than any RLS policy actually uses — isn't a security hole (RLS still
blocks everything), but it's worth finding and documenting so nobody mistakes an unused grant for
an intended access path later.

## Method

A live query against the running local instance (not a static guess over migration text), cross-
referencing every real `anon`/`authenticated` grant against `pg_policies`:

```sql
with grants as (
  select grantee, table_name, privilege_type
  from information_schema.role_table_grants
  where table_schema='public' and grantee in ('anon','authenticated')
    and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
),
policies as (
  select tablename, unnest(roles)::text as role, cmd
  from pg_policies
  where schemaname='public'
)
select g.grantee, g.table_name, g.privilege_type
from grants g
where not exists (
  select 1 from policies p
  where p.tablename = g.table_name
    and (p.role = g.grantee or p.role = 'public')
    and (p.cmd = g.privilege_type or p.cmd = 'ALL')
)
order by 1,2,3;
```

## A real limitation of this method, found immediately

7 of the 15 raw rows this query returns are **views** (`public_fundraising_contributions`,
`public_fundraising_totals`, `public_routes`, `public_transport_rating`,
`public_transport_requests`, `driver_transport_job_view`, `my_moderation_case_view`) — views never
have their own `pg_policies` row (protection comes from RLS on the *base tables* the view's
`SELECT` reads, or from `security_invoker` semantics), so this query always flags every granted
view as a false positive. Worth stating explicitly for whoever next builds an automated version of
this check (a candidate for a future `db:preflight` addition, not built this stage — it would need
real view-definition parsing to resolve which base tables to check instead, more than a text-only
static scan can safely do).

## The 2 real table-level findings

### 1. `rehoming_reviews` grants `anon` SELECT with zero anon-scoped RLS policy — confirmed necessary, not a gap

`animals`' own public-listing RLS policy for `anon` references `rehoming_reviews` inside an
`EXISTS` subquery (checking whether a private-rehoming listing has been admin-approved before
showing it publicly). Postgres requires the *querying* role to hold table-level privilege on every
table a query plan touches — including a table referenced only inside a different table's RLS
policy subquery — so `anon` genuinely needs bare `SELECT` on `rehoming_reviews` just for that
subquery to evaluate at all. `rehoming_reviews`' own RLS (owner/admin-only policies, confirmed via
`pg_policies`: zero policy scoped to `anon` or `public`) still hides every row from a direct `anon`
query. Already documented at the point it was added
(`20260101003000_rehoming_reviews_anon_grant.sql`) — this stage's contribution is a real regression
test (`tests/db/grant-data-api-audit.test.ts`) proving the grant lets the query execute (no 403)
while RLS still returns zero rows, so a future change can't silently break either half.

### 2. `audit_logs` grants `authenticated` UPDATE/DELETE with zero UPDATE/DELETE policy for anyone — deliberate, inert, now regression-tested

`20260101002900_table_grants.sql` applies one blanket `grant select, insert, update, delete ... to
authenticated` statement across ~25 tables at once (its own comment: "RLS remains the actual
row-level security boundary; these GRANTs only open the outer gate for the roles each table's
policies already name"). `audit_logs` only ever had `SELECT`/`INSERT` policies — it's meant to be
genuinely append-only, already stated in `docs/DATABASE_INVARIANTS.md` ("`audit_logs` are
append-only for everyone, including ops/admin"). The broader grant was never a live gap (RLS blocks
100% of UPDATE/DELETE attempts regardless of who's asking, proven directly for the `admin`
persona — the single most-privileged non-superuser role in this schema, the strongest test of the
claim), but had no direct test proving it before this stage.

## Not changed

Neither finding needed a fix. Tightening `audit_logs`' grant to just `select, insert` would be
correct-but-cosmetic churn (RLS already fully closes the gap; no test or real access path would
change) — left alone per this session's own standing discipline against unnecessary changes, with
the new regression test now standing in for what a narrower grant would have provided anyway: proof
the invariant holds, that fails loudly if it ever stops being true.

## EXECUTE grants (functions) — not re-audited here

Function-level `EXECUTE` grants were already the dedicated, thorough subject of Stages IR-13 and
XR-2 (which found and closed the two real "minimal grants" gaps that existed: `has_role()` and
`get_notification_preference()`). Not re-duplicated in this stage — see those stages' own entries
in `docs/AUTONOMOUS_BACKEND_PROGRESS.md` and `scripts/migration-preflight.mjs`'s automated check 5.
