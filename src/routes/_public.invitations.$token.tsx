import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getFriendlyErrorMessage } from "@/lib/errors";
import {
  acceptOrgInvitation,
  declineOrgInvitation,
  getInvitationPreview,
  orgMemberRoleLabels,
  type OrgMemberRole,
} from "@/lib/queries/team";

export const Route = createFileRoute("/_public/invitations/$token")({
  component: InvitationPage,
});

function InvitationPage() {
  const { token } = useParams({ from: "/_public/invitations/$token" });
  const { isSignedIn } = useAuth();

  const previewQuery = useQuery({
    queryKey: ["invitation-preview", token],
    queryFn: () => getInvitationPreview(token),
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptOrgInvitation(token),
    onSuccess: () => toast.success("You've joined the team."),
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, "Could not accept this invitation.")),
  });

  const declineMutation = useMutation({
    mutationFn: () => declineOrgInvitation(token),
    onSuccess: () => toast.success("Invitation declined."),
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, "Could not decline this invitation.")),
  });

  if (previewQuery.isLoading) {
    return <p className="mx-auto max-w-md p-8 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!previewQuery.data) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-medium">This invitation isn't valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have already been used, expired, or been revoked. Ask the organisation to send a
          new one if you still want to join.
        </p>
      </div>
    );
  }

  if (acceptMutation.isSuccess) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-medium">You're in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You've joined {previewQuery.data.org_name} as{" "}
          {orgMemberRoleLabels[previewQuery.data.invited_role as OrgMemberRole]}.
        </p>
        <Button asChild className="mt-4">
          <Link to="/dashboard/foundation/team">Go to the team page</Link>
        </Button>
      </div>
    );
  }

  if (declineMutation.isSuccess) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-medium">Invitation declined</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="font-display text-xl font-medium">You've been invited</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {previewQuery.data.org_name} has invited you to join their team as{" "}
        <strong>{orgMemberRoleLabels[previewQuery.data.invited_role as OrgMemberRole]}</strong>.
      </p>
      {!isSignedIn ? (
        <div className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Sign in with the email this invitation was sent to, then come back to this link.
          </p>
          <Button asChild>
            <Link to="/signin">Sign in</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex justify-center gap-2">
          <Button disabled={acceptMutation.isPending} onClick={() => acceptMutation.mutate()}>
            Accept
          </Button>
          <Button
            variant="outline"
            disabled={declineMutation.isPending}
            onClick={() => declineMutation.mutate()}
          >
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}
