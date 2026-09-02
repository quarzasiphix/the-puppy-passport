import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout — see the identical note in _public.breeders.tsx. /dashboard/breeder/litters is
// dashboard.breeder.litters.index.tsx, /dashboard/breeder/litters/$id is
// dashboard.breeder.litters.$id.tsx.
export const Route = createFileRoute("/dashboard/breeder/litters")({
  component: () => <Outlet />,
});
