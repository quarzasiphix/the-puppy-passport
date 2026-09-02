import { createFileRoute } from "@tanstack/react-router";
import { OpsRequestTable } from "@/domains/transport";

export const Route = createFileRoute("/dashboard/operations/completed")({
  component: () => (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">Completed transports</h1>
      </header>
      <OpsRequestTable fixedStatuses={["completed"]} />
    </div>
  ),
});
