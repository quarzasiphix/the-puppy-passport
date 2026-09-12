import { createFileRoute } from "@tanstack/react-router";
import { ModerationPanel } from "@/domains/trust";

export const Route = createFileRoute("/dashboard/admin/moderation")({
  component: ModerationPanel,
});
