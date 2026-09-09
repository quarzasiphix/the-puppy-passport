-- Fixup: this Supabase project has a default-privilege rule that grants EXECUTE on newly created
-- public-schema functions directly to anon/authenticated (not via the PUBLIC pseudo-role), so the
-- previous migration's `revoke all ... from public` alone left both new functions callable by
-- `anon` — confirmed via information_schema.routine_privileges and the security advisor. Neither
-- function should ever be anon-callable: prevent_client_writes_to_deposit_payment_fields() is a
-- trigger body only (meaningless called directly — no OLD/NEW outside trigger context) and
-- request_reservation_deposit() requires an authenticated breeder/admin already, but "requires a
-- valid auth.uid()" should be defense-in-depth, not the only gate, matching every other RPC's
-- explicit revoke+grant in this schema (see 20260101010800_rpc_grant_hygiene.sql).

revoke all on function public.prevent_client_writes_to_deposit_payment_fields() from public, anon, authenticated;

revoke all on function public.request_reservation_deposit(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.request_reservation_deposit(uuid, numeric, text) to authenticated;
