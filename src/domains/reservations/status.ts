import type { Database } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------------------------
// Reservation status — single source of truth for the reservation workflow state machine.
//
// A reservation is a business workflow, modelled independently of any payment provider. Before
// this module, status was compared as raw strings scattered across route components
// (`r.status === "awaiting_buyer"` etc.) with no notion of which transitions are legal. Every
// reservation-facing surface should import from here instead.
//
// The vocabulary below is the *current database enum* (`public.reservation_status`, defined in
// supabase/migrations/20260101001100_reservations.sql). The product brief describes a richer
// set (draft / submitted / awaiting_seller_acceptance / accepted / awaiting_payment /
// payment_processing / reserved / refund_pending / refunded / disputed …). Widening the enum is
// a deliberate, separate DB migration — see ReservationStatusRoadmap and
// docs/RESERVATION_PAYMENT_DESIGN.md. This machine is structured so that widening it is additive
// (extend the union + the transition map), never a rewrite.
// ---------------------------------------------------------------------------------------------

/** The live database enum. Do not compare reservation status against bare strings anywhere else. */
export type ReservationStatus = Database["public"]["Enums"]["reservation_status"];

export const RESERVATION_STATUSES = [
  "awaiting_breeder",
  "awaiting_buyer",
  "confirmed",
  "cancelled",
  "completed",
] as const satisfies readonly ReservationStatus[];

export const RESERVATION_TERMINAL_STATUSES = ["cancelled", "completed"] as const;

export function isTerminalReservationStatus(status: ReservationStatus): boolean {
  return (RESERVATION_TERMINAL_STATUSES as readonly string[]).includes(status);
}

// Allowed forward transitions. Keys are the current status, values are every status the
// reservation may legally move to from there. An empty array = terminal state.
export const RESERVATION_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  awaiting_breeder: ["awaiting_buyer", "confirmed", "cancelled"],
  awaiting_buyer: ["awaiting_breeder", "confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionReservation(from: ReservationStatus, to: ReservationStatus): boolean {
  return RESERVATION_TRANSITIONS[from].includes(to);
}

/**
 * Throws a descriptive error if the transition is not allowed. Use in services / mutation
 * handlers before calling an RPC or update. This is a UX/consistency guard; the database RPCs
 * and RLS remain the real enforcement boundary.
 */
export function assertReservationTransition(from: ReservationStatus, to: ReservationStatus): void {
  if (from === to) return;
  if (!canTransitionReservation(from, to)) {
    throw new Error(
      `Invalid reservation transition: "${from}" → "${to}". Allowed from "${from}": ` +
        (RESERVATION_TRANSITIONS[from].join(", ") || "(none — terminal state)"),
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------------------------

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  awaiting_breeder: "Awaiting breeder",
  awaiting_buyer: "Awaiting buyer",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const RESERVATION_STATUS_STYLES: Record<ReservationStatus, string> = {
  awaiting_breeder: "bg-warning/20 text-foreground",
  awaiting_buyer: "bg-warning/20 text-foreground",
  confirmed: "bg-success/15 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  completed: "bg-muted text-muted-foreground",
};

export function reservationStatusLabel(status: string): string {
  return RESERVATION_STATUS_LABELS[status as ReservationStatus] ?? status.replace(/_/g, " ");
}

/** Statuses the breeder still needs to act on. Replaces the inline filter in the breeder overview. */
export function isReservationAwaitingBreederAction(status: ReservationStatus): boolean {
  return status === "awaiting_breeder" || status === "awaiting_buyer";
}

// ---------------------------------------------------------------------------------------------
// Roadmap — the target vocabulary once payments land. NOT wired: needs a DB enum migration.
// Kept here so the payment/reservation UI can be typed against the intended contract today.
// ---------------------------------------------------------------------------------------------

export type ReservationStatusRoadmap =
  | ReservationStatus
  | "draft"
  | "submitted"
  | "awaiting_seller_acceptance"
  | "accepted"
  | "awaiting_payment"
  | "payment_processing"
  | "reserved"
  | "rejected"
  | "expired"
  | "refund_pending"
  | "refunded"
  | "disputed";
