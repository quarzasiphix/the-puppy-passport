import { createFileRoute } from "@tanstack/react-router";
import { OpsRequestTable } from "@/domains/transport";

export const Route = createFileRoute("/dashboard/operations/compliance-holds")({
  component: () => (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">Compliance holds</h1>
        <p className="text-sm text-muted-foreground">Requests on compliance or veterinary hold.</p>
      </header>
      <OpsRequestTable fixedStatuses={["compliance_hold", "veterinary_hold"]} />
    </div>
  ),
});
