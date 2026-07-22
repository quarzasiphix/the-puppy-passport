import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout — see the pattern note in _public.breeders.tsx (docs/DECISIONS.md). /fundraising is
// _public.fundraising.index.tsx, /fundraising/$id is _public.fundraising.$id.tsx.
export const Route = createFileRoute("/_public/fundraising")({
  component: () => <Outlet />,
});
