// Public API of the reservations domain. Other domains and route shells import from here only —
// never reach into ./services, ./pages or internal files directly.

export {
  listMyReservationsAsBuyer,
  listReservationsForMyKennel,
  convertApplicationToReservation,
  requestReservationDeposit,
} from "./services/reservations";

export type {
  ReservationSummary,
  ReservationRow,
  ConvertApplicationToReservationInput,
} from "./types";

export {
  RESERVATION_STATUSES,
  RESERVATION_TRANSITIONS,
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_STYLES,
  canTransitionReservation,
  assertReservationTransition,
  isTerminalReservationStatus,
  isReservationAwaitingBreederAction,
  reservationStatusLabel,
} from "./status";
export type { ReservationStatus, ReservationStatusRoadmap } from "./status";

export { BreederReservationsPage } from "./pages/breeder-reservations-page";
export { BuyerReservationsPage } from "./pages/buyer-reservations-page";
export { RequestDepositDialog } from "./components/request-deposit-dialog";
export { PayDepositButton } from "./components/pay-deposit-button";
