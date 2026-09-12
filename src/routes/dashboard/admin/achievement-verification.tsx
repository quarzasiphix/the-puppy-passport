import { createFileRoute } from "@tanstack/react-router";
import { AchievementVerificationPanel } from "@/domains/animals";

export const Route = createFileRoute("/dashboard/admin/achievement-verification")({
  component: AchievementVerificationPanel,
});
