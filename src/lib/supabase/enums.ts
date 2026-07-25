import type { Database } from "./types";

// Stage IR-5 (integration-readiness queue): convenient, stable aliases for the enum types real
// generated Supabase types expose under `Database["public"]["Enums"][...]`. Kept in this separate,
// hand-written file (not inside types.ts itself) specifically so it survives a future
// `npm run db:types` regeneration unchanged -- types.ts gets fully overwritten by that command,
// this file never is.
export type TransportStatus = Database["public"]["Enums"]["transport_status"];
export type LitterStatus = Database["public"]["Enums"]["litter_status"];
export type AnimalAvailabilityStatus = Database["public"]["Enums"]["animal_availability_status"];
export type TransportServiceType = Database["public"]["Enums"]["transport_service_type"];
export type TransportDocumentCategory = Database["public"]["Enums"]["transport_document_category"];
export type CollectionMethod = Database["public"]["Enums"]["collection_method"];
