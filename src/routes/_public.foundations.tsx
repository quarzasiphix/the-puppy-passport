import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout — /foundations itself is _public.foundations.index.tsx, /foundations/$slug is
// _public.foundations.$slug.tsx. This file used to contain the list-page content directly with no
// <Outlet/>, which meant /foundations/$slug never actually rendered its own component at all —
// the exact same bug already found and fixed for /breeders (see _public.breeders.tsx and
// docs/DECISIONS.md), reintroduced here because this file was added on a branch that forked
// before that fix landed.
export const Route = createFileRoute("/_public/foundations")({
  component: () => <Outlet />,
});
