import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout — /dashboard/foundation/fundraising is
// dashboard.foundation.fundraising.index.tsx, /dashboard/foundation/fundraising/$id is
// dashboard.foundation.fundraising.$id.tsx (see docs/DECISIONS.md on this pattern).
export const Route = createFileRoute("/dashboard/foundation/fundraising")({
  component: () => <Outlet />,
});
