import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout — see the identical note in dashboard/breeder/litters.tsx.
// /dashboard/transport-company/trips is trips.index.tsx,
// /dashboard/transport-company/trips/$tripId is trips.$tripId.tsx.
export const Route = createFileRoute("/dashboard/transport-company/trips")({
  component: () => <Outlet />,
});
