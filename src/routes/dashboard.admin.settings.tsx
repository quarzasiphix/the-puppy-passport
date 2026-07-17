import { createFileRoute } from "@tanstack/react-router";
import { NotImplemented } from "@/components/not-implemented";

export const Route = createFileRoute("/dashboard/admin/settings")({
  component: () => (
    <NotImplemented
      title="Settings"
      purpose="Platform-wide configuration, including featured-breeder selection."
    />
  ),
});
