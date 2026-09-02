import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout — see the identical note in _public.breeders.tsx. /adoptions is
// _public.adoptions.index.tsx, /adoptions/$id is _public.adoptions.$id.tsx.
export const Route = createFileRoute("/_public/adoptions")({
  component: () => <Outlet />,
});
