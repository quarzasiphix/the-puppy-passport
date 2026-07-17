import { createFileRoute } from "@tanstack/react-router";
import { NotImplemented } from "@/components/not-implemented";

export const Route = createFileRoute("/dashboard/buyer/scheduled")({
  component: () => (
    <NotImplemented
      title="Scheduled transports"
      purpose="Transport requests that have moved past quotation into a confirmed pickup date and route will appear here, with a live status timeline."
    />
  ),
});
