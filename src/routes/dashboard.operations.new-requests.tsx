import { createFileRoute } from "@tanstack/react-router";
import { OpsRequestTable } from "@/components/ops-request-table";

export const Route = createFileRoute("/dashboard/operations/new-requests")({
  component: () => (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">New requests</h1>
        <p className="text-sm text-muted-foreground">Submitted, not yet reviewed.</p>
      </header>
      <OpsRequestTable fixedStatuses={["submitted", "initial_review"]} />
    </div>
  ),
});
