import { createFileRoute } from "@tanstack/react-router";
import { NotImplemented } from "@/components/not-implemented";

export const Route = createFileRoute("/dashboard/admin/organisations")({
  component: () => (
    <NotImplemented
      title="Organisations"
      purpose="Manage all kennels, foundations and shelters — suspend or restore any organisation."
    />
  ),
});
