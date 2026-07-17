import { createFileRoute } from "@tanstack/react-router";
import { VerificationReviewList } from "@/components/verification-review-list";

export const Route = createFileRoute("/dashboard/admin/foundation-verification")({
  component: () => (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Foundation verification</h1>
        <p className="text-sm text-muted-foreground">
          Approving creates the organisation's public profile and activates the applicant's
          foundation/shelter role.
        </p>
      </header>
      <VerificationReviewList
        verificationType="organisation"
        emptyLabel="No foundation or shelter applications yet."
      />
    </div>
  ),
});
