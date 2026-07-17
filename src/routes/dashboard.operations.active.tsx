import { createFileRoute } from "@tanstack/react-router";
import { OpsRequestTable } from "@/components/ops-request-table";

export const Route = createFileRoute("/dashboard/operations/active")({
  component: () => (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">Active transports</h1>
        <p className="text-sm text-muted-foreground">Scheduled through in-transit.</p>
      </header>
      <OpsRequestTable
        fixedStatuses={[
          "scheduled",
          "driver_assigned",
          "pickup_confirmed",
          "animal_collected",
          "in_transport",
          "rest_or_care_stop",
          "approaching_destination",
        ]}
      />
    </div>
  ),
});
