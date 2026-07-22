import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout — see the identical note in _public.breeders.tsx. /transport is
// _public.transport.index.tsx, /transport/request is _public.transport.request.tsx.
export const Route = createFileRoute("/_public/transport")({
  component: () => <Outlet />,
});
