import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout — see the identical note in dashboard/breeder/litters.tsx and
// dashboard/transport-company/trips.tsx. /dashboard/operations/routes/$id is
// routes.$id.index.tsx, /dashboard/operations/routes/$id/stop/$stopId is
// routes.$id.stop.$stopId.tsx.
export const Route = createFileRoute("/dashboard/operations/routes/$id")({
  component: () => <Outlet />,
});
