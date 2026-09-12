import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// Breeder payout tracking (manual-payout v1) — see supabase/migrations/20260912130000_
// reservation_payouts.sql. A `reservation_payouts` row is created automatically (by a DB trigger,
// never this file) the moment a reservation's deposit is marked paid; it is never client-writable
// except through markReservationPayoutPaid below, which is admin/ops-only server-side.

export type PayoutStatus = "owed" | "paid";

export type PayoutRow = {
  id: string;
  reservationId: string;
  organizationId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  dueAt: string;
  paidAt: string | null;
  payoutReference: string | null;
  puppyName: string;
  kennelName: string;
};

type RawPayoutRow = {
  id: string;
  reservation_id: string;
  organization_id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  due_at: string;
  paid_at: string | null;
  payout_reference: string | null;
  reservations: { animals: { name: string } | null } | null;
  organisations: { name: string } | null;
};

const payoutSelect =
  "id, reservation_id, organization_id, amount, currency, status, due_at, paid_at, payout_reference, reservations(animals(name)), organisations(name)";

function mapPayout(r: RawPayoutRow): PayoutRow {
  return {
    id: r.id,
    reservationId: r.reservation_id,
    organizationId: r.organization_id,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    dueAt: r.due_at,
    paidAt: r.paid_at,
    payoutReference: r.payout_reference,
    puppyName: r.reservations?.animals?.name ?? "Unknown puppy",
    kennelName: r.organisations?.name ?? "",
  };
}

export async function listMyOrgPayouts(orgId: string): Promise<PayoutRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("reservation_payouts")
    .select(payoutSelect)
    .eq("organization_id", orgId)
    .order("due_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as RawPayoutRow[]).map(mapPayout);
}

/** Admin/ops only — RLS (`admins manage all payouts`) is the real boundary; this just reads
 * every organisation's rows instead of one. */
export async function listAllPayouts(): Promise<PayoutRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("reservation_payouts")
    .select(payoutSelect)
    .order("due_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as RawPayoutRow[]).map(mapPayout);
}

/** Admin/ops only — all real authorization lives in mark_reservation_payout_paid() itself. */
export async function markReservationPayoutPaid(
  payoutId: string,
  reference?: string,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("mark_reservation_payout_paid", {
    p_payout_id: payoutId,
    p_payout_reference: reference?.trim() || undefined,
  });
  if (error) throw error;
}
