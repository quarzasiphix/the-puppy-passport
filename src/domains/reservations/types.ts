import type { CollectionMethod } from "@/lib/supabase/enums";
import type { ReservationStatus } from "./status";

// Row shape as selected from PostgREST (see reservationSelect in ./services/reservations.ts).
export type ReservationRow = {
  id: string;
  status: ReservationStatus;
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

// View model used by every reservation list surface (breeder + buyer).
export type ReservationSummary = {
  id: string;
  animalId: string;
  puppyName: string;
  breed: string;
  status: ReservationStatus;
  agreedPrice: number | null;
  currency: string;
  depositStatus: string;
  agreementStatus: string;
  plannedCollectionDate: string | null;
  buyerName: string;
  buyerCity: string;
  kennelName: string;
};

export type ConvertApplicationToReservationInput = {
  applicationId: string;
  agreedPrice?: number | null;
  currency?: string;
  plannedCollectionDate?: string | null;
  collectionMethod?: CollectionMethod | null;
  notes?: string | null;
};
