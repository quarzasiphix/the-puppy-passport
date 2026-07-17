import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type ReservationRow = {
  id: string;
  status: string;
  agreed_price: number | null;
  currency: string | null;
  deposit_status: string;
  agreement_status: string;
  planned_collection_date: string | null;
  created_at: string;
  animal_id: string;
  animals: { name: string; breeds: { name: string } | null } | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    city: string | null;
    country: string | null;
  } | null;
  organisations: { name: string } | null;
};

export type ReservationSummary = {
  id: string;
  animalId: string;
  puppyName: string;
  breed: string;
  status: string;
  agreedPrice: number | null;
  currency: string;
  depositStatus: string;
  agreementStatus: string;
  plannedCollectionDate: string | null;
  buyerName: string;
  buyerCity: string;
  kennelName: string;
};

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
