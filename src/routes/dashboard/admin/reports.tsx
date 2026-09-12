import { createFileRoute } from "@tanstack/react-router";
import { ReportsPanel } from "@/domains/trust";

export const Route = createFileRoute("/dashboard/admin/reports")({
  component: ReportsPanel,
});
