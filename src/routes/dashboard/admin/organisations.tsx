import { createFileRoute } from "@tanstack/react-router";
import { OrganisationsPanel } from "@/domains/identity";

export const Route = createFileRoute("/dashboard/admin/organisations")({
  component: OrganisationsPanel,
});
