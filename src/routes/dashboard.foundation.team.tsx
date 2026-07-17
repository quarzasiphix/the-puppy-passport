import { createFileRoute } from "@tanstack/react-router";
import { NotImplemented } from "@/components/not-implemented";

export const Route = createFileRoute("/dashboard/foundation/team")({
  component: () => (
    <NotImplemented
      title="Team"
      purpose="Invite volunteers and staff to your organisation and manage their role (administrator, employee, volunteer)."
    />
  ),
});
