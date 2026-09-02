import { createFileRoute } from "@tanstack/react-router";
import { VerificationReviewList } from "@/domains/trust";

export const Route = createFileRoute("/dashboard/admin/breeder-verification")({
  component: () => (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Breeder verification</h1>
        <p className="text-sm text-muted-foreground">
          Approving creates the kennel's public organisation and activates their breeder role.
          Nothing here is automatic.
        </p>
      </header>
      <VerificationReviewList
        verificationType="breeder"
        emptyLabel="No breeder applications yet."
      />
    </div>
  ),
});
