import { test } from "node:test";
import assert from "node:assert/strict";

import {
  RESERVATION_STATUSES,
  RESERVATION_TRANSITIONS,
  canTransitionReservation,
  assertReservationTransition,
  isTerminalReservationStatus,
  isReservationAwaitingBreederAction,
  reservationStatusLabel,
} from "../../src/domains/reservations/status.ts";

test("every status has a transition entry", () => {
  for (const status of RESERVATION_STATUSES) {
    assert.ok(status in RESERVATION_TRANSITIONS, `missing transition list for "${status}"`);
  }
});

test("terminal statuses have no outgoing transitions", () => {
  assert.deepEqual(RESERVATION_TRANSITIONS.completed, []);
  assert.deepEqual(RESERVATION_TRANSITIONS.cancelled, []);
  assert.ok(isTerminalReservationStatus("completed"));
  assert.ok(isTerminalReservationStatus("cancelled"));
  assert.ok(!isTerminalReservationStatus("confirmed"));
});

test("allows legal transitions", () => {
  assert.ok(canTransitionReservation("awaiting_breeder", "confirmed"));
  assert.ok(canTransitionReservation("awaiting_breeder", "awaiting_buyer"));
  assert.ok(canTransitionReservation("awaiting_buyer", "confirmed"));
  assert.ok(canTransitionReservation("confirmed", "completed"));
  assert.ok(canTransitionReservation("confirmed", "cancelled"));
});

test("rejects illegal transitions", () => {
  assert.ok(!canTransitionReservation("completed", "confirmed"));
  assert.ok(!canTransitionReservation("cancelled", "confirmed"));
  assert.ok(!canTransitionReservation("awaiting_breeder", "completed"));
  assert.ok(!canTransitionReservation("confirmed", "awaiting_breeder"));
});

test("assertReservationTransition throws on an illegal move, is a no-op for same-status", () => {
  assert.throws(
    () => assertReservationTransition("completed", "confirmed"),
    /Invalid reservation transition/,
  );
  assert.throws(
    () => assertReservationTransition("awaiting_breeder", "completed"),
    /Invalid reservation transition/,
  );
  assert.doesNotThrow(() => assertReservationTransition("confirmed", "confirmed"));
  assert.doesNotThrow(() => assertReservationTransition("awaiting_breeder", "confirmed"));
});

test("isReservationAwaitingBreederAction matches only the two awaiting states", () => {
  assert.ok(isReservationAwaitingBreederAction("awaiting_breeder"));
  assert.ok(isReservationAwaitingBreederAction("awaiting_buyer"));
  assert.ok(!isReservationAwaitingBreederAction("confirmed"));
  assert.ok(!isReservationAwaitingBreederAction("completed"));
});

test("reservationStatusLabel humanises known and unknown values", () => {
  assert.equal(reservationStatusLabel("awaiting_breeder"), "Awaiting breeder");
  assert.equal(reservationStatusLabel("confirmed"), "Confirmed");
  assert.equal(reservationStatusLabel("some_future_state"), "some future state");
});
