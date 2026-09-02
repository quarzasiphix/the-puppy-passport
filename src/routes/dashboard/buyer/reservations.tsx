import { createFileRoute } from "@tanstack/react-router";
import { BuyerReservationsPage } from "@/domains/reservations";

export const Route = createFileRoute("/dashboard/buyer/reservations")({
  component: BuyerReservationsPage,
});
