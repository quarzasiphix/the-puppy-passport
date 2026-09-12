import { createFileRoute } from "@tanstack/react-router";
import { RehomingReviewsPanel } from "@/domains/marketplace";

export const Route = createFileRoute("/dashboard/admin/listings")({
  component: RehomingReviewsPanel,
});
