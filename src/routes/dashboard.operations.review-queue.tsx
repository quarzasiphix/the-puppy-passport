import { createFileRoute } from "@tanstack/react-router";
import { OpsRequestTable } from "@/components/ops-request-table";

export const Route = createFileRoute("/dashboard/operations/review-queue")({
  component: () => (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">Review queue</h1>
        <p className="text-sm text-muted-foreground">
          Every transport request, filterable by status and service.
        </p>
      </header>
      <OpsRequestTable showFilters />
    </div>
  ),
});
