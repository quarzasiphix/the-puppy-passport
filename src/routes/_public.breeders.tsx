import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout — /breeders itself is _public.breeders.index.tsx, /breeders/$slug is
// _public.breeders.$slug.tsx. Found and fixed 2026-07-22: this file used to contain the list-page
// content directly with no <Outlet/>, which meant /breeders/$slug never actually rendered its own
// component at all — TanStack Router matched the nested route correctly (confirmed by the
// resulting page's real <title>), but with no Outlet to mount it in, only this file's own
// (list-page) content ever appeared in the DOM. See docs/DECISIONS.md.
export const Route = createFileRoute("/_public/breeders")({
  component: () => <Outlet />,
});
