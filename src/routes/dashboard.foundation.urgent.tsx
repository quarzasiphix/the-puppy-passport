import { createFileRoute } from "@tanstack/react-router";
import { NotImplemented } from "@/components/not-implemented";

export const Route = createFileRoute("/dashboard/foundation/urgent")({
  component: () => (
    <NotImplemented
      title="Urgent cases"
      purpose="Flag welfare-urgent animals or transport needs for operations' attention — a flag here does not itself grant transport priority."
    />
  ),
});
