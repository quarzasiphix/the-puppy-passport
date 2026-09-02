// MOVED — this module now lives in the reservations domain.
//
//   New home:  src/domains/reservations/  (import from "@/domains/reservations")
//
// This file is a temporary compatibility shim so callers not yet migrated to the domain barrel
// keep working. Remaining importers: src/routes/dashboard.breeder.index.tsx,
// src/routes/dashboard.breeder.applications.tsx. Delete this file once those move into their
// domains (breeders/, marketplace/). See docs/FILE_MIGRATION_MAP.md.

export {
  listMyReservationsAsBuyer,
  listReservationsForMyKennel,
  convertApplicationToReservation,
} from "@/domains/reservations";
export type {
  ReservationSummary,
  ConvertApplicationToReservationInput,
} from "@/domains/reservations";
