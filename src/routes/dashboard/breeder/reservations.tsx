import { createFileRoute } from "@tanstack/react-router";
import { BreederReservationsPage } from "@/domains/reservations";

export const Route = createFileRoute("/dashboard/breeder/reservations")({
  component: BreederReservationsPage,
});
