-- Stage BR (supplemental queue): API contracts. Audited the real client-callable RPC surface (30
-- functions granted execute to `authenticated` across the whole schema) against this codebase's
-- own established hardening convention: every admin/staff/actor-gated RPC should have an explicit
-- `revoke all ... from public` before its `grant execute ... to authenticated`, not rely solely on
-- an internal `auth.uid()`/role check. Postgres grants EXECUTE to the PUBLIC pseudo-role by default
-- on every new function; a `grant ... to authenticated` layered on top of that default is purely
-- additive and does *not* remove the anon role's implicit PUBLIC-level access, since GRANT never
-- restricts. Every function's actual internal check (verified to be present, correct, and
-- unconditionally first, in every case below) already makes this functionally safe today, but it's
-- a missing defense-in-depth layer compared to the 25+ other RPCs this session already hardened
-- this way (claim_moderation_case, claim_support_case, execute_account_deletion,
-- mark_risk_signal_reviewed, get_invitation_by_token, and more) -- a real, demonstrated
-- inconsistency in the contract's enforcement, not a hypothetical one.
--
-- Found four: approve_user_verification (admin-only, checked via is_admin() first -- the exact
-- sibling shape to claim_moderation_case/execute_account_deletion, which already have this),
-- get_my_profile, start_application_conversation, and start_transport_conversation (all three
-- already correctly reject a null auth.uid() as their first check, just never had the matching
-- revoke statement added alongside their original grant).
revoke all on function public.approve_user_verification(uuid, text) from public;
grant execute on function public.approve_user_verification(uuid, text) to authenticated;

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;

revoke all on function public.start_application_conversation(uuid, uuid) from public;
grant execute on function public.start_application_conversation(uuid, uuid) to authenticated;

revoke all on function public.start_transport_conversation(uuid) from public;
grant execute on function public.start_transport_conversation(uuid) to authenticated;
