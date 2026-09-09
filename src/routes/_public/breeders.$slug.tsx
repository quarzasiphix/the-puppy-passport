import { createFileRoute, redirect } from "@tanstack/react-router";

// The canonical public breeder profile URL is now /@handle (see @$handle.tsx) — a breeder's
// permanent, linkable identity (anemalo.com/@gryfin), independent of whether they currently have
// puppies listed. This route is kept only so existing links/bookmarks to the old
// /breeders/$slug path keep working, via a redirect — never rendering its own copy of the
// profile, so the two URLs are never both indexable for the same kennel (see the canonical <link>
// tag on @$handle.tsx).
export const Route = createFileRoute("/_public/breeders/$slug")({
  loader: ({ params }) => {
    throw redirect({ to: "/@$handle", params: { handle: params.slug } });
  },
});
