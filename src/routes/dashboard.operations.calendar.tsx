import { createFileRoute } from "@tanstack/react-router";
import { NotImplemented } from "@/components/not-implemented";

export const Route = createFileRoute("/dashboard/operations/calendar")({
  component: () => (
    <NotImplemented
      title="Calendar"
      purpose="A calendar view of pickups, routes and driver/vehicle availability."
    />
  ),
});
