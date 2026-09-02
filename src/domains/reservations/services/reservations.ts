import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ConvertApplicationToReservationInput,
  ReservationRow,
  ReservationSummary,
} from "../types";

const reservationSelect =
  "id, status, agreed_price, currency, deposit_status, agreement_status, planned_collection_date, created_at, animal_id, animals(name, breeds(name)), profiles!reservations_buyer_id_fkey(first_name, last_name, city, country), organisations!reservations_organization_id_fkey(name)";

function mapReservation(r: ReservationRow): ReservationSummary {
  return {
    id: r.id,
    animalId: r.animal_id,
    puppyName: r.animals?.name ?? "Unknown puppy",
    breed: r.animals?.breeds?.name ?? "Mixed breed",
    status: r.status,
    agreedPrice: r.agreed_price,
    currency: r.currency ?? "PLN",
    depositStatus: r.deposit_status,
    agreementStatus: r.agreement_status,
    plannedCollectionDate: r.planned_collection_date,
    buyerName: [r.profiles?.first_name, r.profiles?.last_name].filter(Boolean).join(" ") || "Buyer",
    buyerCity: [r.profiles?.city, r.profiles?.country].filter(Boolean).join(", "),
    kennelName: r.organisations?.name ?? "",
  };
}

export async function listMyReservationsAsBuyer(buyerId: string): Promise<ReservationSummary[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(reservationSelect)
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ReservationRow[]).map(mapReservation);
}

export async function listReservationsForMyKennel(orgId: string): Promise<ReservationSummary[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(reservationSelect)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ReservationRow[]).map(mapReservation);
}

// Stage IR-6: the one real way to create a reservation. convert_application_to_reservation() does
// the reservation insert, the application status flip, and the animal availability update
// atomically in one transaction (see the migration for why a client-side multi-write is unsafe).
// Only callable by the organisation the application was submitted to (or an admin), and only from
// an application that is genuinely status='approved' — both enforced server-side.
export async function convertApplicationToReservation(
  input: ConvertApplicationToReservationInput,
): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("convert_application_to_reservation", {
    p_application_id: input.applicationId,
    p_agreed_price: input.agreedPrice ?? undefined,
    p_currency: input.currency ?? undefined,
    p_planned_collection_date: input.plannedCollectionDate ?? undefined,
    p_collection_method: input.collectionMethod ?? undefined,
    p_notes: input.notes ?? undefined,
  });
  if (error) throw error;
  return data as string;
}
