import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout — see the identical note in _public.breeders.tsx. /dashboard/operations/routes is
// dashboard.operations.routes.index.tsx, /dashboard/operations/routes/$id is
// dashboard.operations.routes.$id.tsx.
export const Route = createFileRoute("/dashboard/operations/routes")({
  component: () => <Outlet />,
});
