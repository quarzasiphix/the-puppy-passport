import { createFileRoute } from "@tanstack/react-router";
import { NotImplemented } from "@/components/not-implemented";

export const Route = createFileRoute("/dashboard/foundation/documents")({
  component: () => (
    <NotImplemented
      title="Documents"
      purpose="Organisation registration and per-animal documents will be managed here."
    />
  ),
});
