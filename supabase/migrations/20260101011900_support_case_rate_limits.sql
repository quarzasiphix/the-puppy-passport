-- Stage CJP (third/fourth supplemental queue): rate-limit configuration. Audited every real
-- customer-reachable creation path against Stage J's `enforce_rate_limit()` (already wired to
-- report_submission, message_send, welfare_case_submission, application_submission,
-- transport_draft_creation, transport_amendment_request, org_invitation) and found two genuinely
-- unlimited paths: `support_cases` and `support_case_messages` (Stage BL-addendum) had no rate
-- limit of any kind -- an authenticated user could spam-create unlimited support cases, or unlimited
-- messages inside one, directly via the Data API (no RPC required, since RLS alone already permits
-- the plain insert). The exact same "reachable, no limit at all" shape Stage J itself found and
-- fixed for reports/messages/welfare cases/applications, just never checked for this table because
-- it didn't exist yet at Stage J's time.
--
-- Everything else this stage's own checklist named is already covered and NOT duplicated here:
-- signup/sign-in is rate-limited by GoTrue itself (`[auth.rate_limit] sign_in_sign_ups = 30` per 5
-- minutes per IP, supabase/config.toml -- a real, externally-configured limit, not app code, so
-- correctly left alone); invitations (org_invitation), messages (message_send), applications
-- (application_submission), reports (report_submission), and transport requests
-- (transport_draft_creation/transport_amendment_request) were already wired at Stage J/K; appeals
-- (`moderation_appeals`) need no rate limit at all -- `unique (moderation_case_id)` on that table
-- already makes more than one appeal per case structurally impossible, a stronger guarantee than
-- any throttle; quotations are staff-created only (`createQuotation()`, ops/admin), not a
-- customer-reachable creation path; attachment/document Storage uploads are a genuinely different
-- mechanism (object uploads go directly through the Storage API, not a Postgres INSERT this
-- trigger shape can intercept) -- a real, separate future item, not silently skipped, tracked in
-- docs/TECH_DEBT_REGISTER.md rather than solved here to avoid conflating two different enforcement
-- layers in one migration.
--
-- Same shape as Stage J's own four triggers exactly: server-derived actor (auth.uid() inside
-- enforce_rate_limit(), never a caller-supplied value), deterministic window, bounded count, the
-- same stable rate_limited error message, self-pruning (Stage BU already applies to every
-- action_key via enforce_rate_limit()'s own opportunistic delete, this needs no new code for that).
create or replace function public.rate_limit_support_case_creation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_rate_limit('support_case_creation', 60, interval '1 hour');
  return new;
end;
$$;

create trigger rate_limit_support_case_creation
  before insert on public.support_cases
  for each row execute function public.rate_limit_support_case_creation();

-- Same generous threshold as rate_limit_message_send() (30/minute) and the same reasoning: a real,
-- busy back-and-forth (customer or staff) stays well under it; only genuine flooding is stopped.
create or replace function public.rate_limit_support_case_message_send()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_rate_limit('support_case_message_send', 30, interval '1 minute');
  return new;
end;
$$;

create trigger rate_limit_support_case_message_send
  before insert on public.support_case_messages
  for each row execute function public.rate_limit_support_case_message_send();

-- Found while writing this stage's own tests, not invented: `support_cases` (Stage BL-addendum)
-- was granted select/insert/update but never delete, even though "ops staff manage all support
-- cases" is a `for all` RLS policy that includes delete -- the same GRANT-vs-RLS gap class
-- (RLS would allow it, but the table-level grant blocks it first) this session has now found and
-- fixed 7 separate times (Stage BR/CA/BK among them). Grant is table-level and coarse by design;
-- RLS still restricts *which* rows -- an ordinary customer has no delete policy match on this
-- table at all, so they can delete zero rows regardless of this grant. Confirmed reachable, not
-- speculative: tests/db/support-cases.test.ts's own existing cleanup steps call
-- `admin.from("support_cases").delete(...)` and, until now, silently failed every single time
-- without asserting the result -- exactly the "cleanup that silently ignores errors" class this
-- stage's own review checklist named.
grant delete on public.support_cases to authenticated;
