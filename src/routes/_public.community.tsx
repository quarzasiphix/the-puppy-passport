import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout — see the identical note in _public.breeders.tsx. /community is
// _public.community.index.tsx, /community/groups is _public.community.groups.tsx (itself a layout
// with its own /community/groups/index.tsx + /community/groups/$slug.tsx).
export const Route = createFileRoute("/_public/community")({
  component: () => <Outlet />,
});
