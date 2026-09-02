import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout — see the identical note in _public.breeders.tsx. /community/groups is
// _public.community.groups.index.tsx, /community/groups/$slug is
// _public.community.groups.$slug.tsx.
export const Route = createFileRoute("/_public/community/groups")({
  component: () => <Outlet />,
});
