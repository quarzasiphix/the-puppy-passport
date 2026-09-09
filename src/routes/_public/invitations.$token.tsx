import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";
import {
  acceptOrgInvitation,
  declineOrgInvitation,
  getInvitationPreview,
  orgMemberRoleLabels,
  type OrgMemberRole,
} from "@/domains/identity";

export const Route = createFileRoute("/_public/invitations/$token")({
  component: InvitationPage,
});

function InvitationPage() {
  const { token } = useParams({ from: "/_public/invitations/$token" });
  const { isSignedIn } = useAuth();
  const { t } = useTranslation();

  const previewQuery = useQuery({
    queryKey: ["invitation-preview", token],
    queryFn: () => getInvitationPreview(token),
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptOrgInvitation(token),
    onSuccess: () => toast.success(t("invitationsPage.joinedToast")),
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("invitationsPage.couldNotAccept"))),
  });

  const declineMutation = useMutation({
    mutationFn: () => declineOrgInvitation(token),
    onSuccess: () => toast.success(t("invitationsPage.declinedToast")),
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("invitationsPage.couldNotDecline"))),
  });

  if (previewQuery.isLoading) {
    return (
      <p className="mx-auto max-w-md p-8 text-sm text-muted-foreground">
        {t("invitationsPage.loading")}
      </p>
    );
  }

  if (!previewQuery.data) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-medium">{t("invitationsPage.invalidTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("invitationsPage.invalidBody")}</p>
      </div>
    );
  }

  if (acceptMutation.isSuccess) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-medium">{t("invitationsPage.joinedTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("invitationsPage.joinedBodyPrefix")}
          {previewQuery.data.org_name}
          {t("invitationsPage.joinedBodyMid")}
          {orgMemberRoleLabels[previewQuery.data.invited_role as OrgMemberRole]}
          {t("invitationsPage.joinedBodySuffix")}
        </p>
        <Button asChild className="mt-4">
          <Link to="/dashboard/foundation/team">{t("invitationsPage.goToTeam")}</Link>
        </Button>
      </div>
    );
  }

  if (declineMutation.isSuccess) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-medium">{t("invitationsPage.declinedTitle")}</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="font-display text-xl font-medium">{t("invitationsPage.invitedTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {previewQuery.data.org_name}
        {t("invitationsPage.invitedBodyMid")}
        <strong>{orgMemberRoleLabels[previewQuery.data.invited_role as OrgMemberRole]}</strong>
        {t("invitationsPage.invitedBodySuffix")}
      </p>
      {!isSignedIn ? (
        <div className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground">{t("invitationsPage.signInHint")}</p>
          <Button asChild>
            <Link to="/signin">{t("nav.signIn")}</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex justify-center gap-2">
          <Button disabled={acceptMutation.isPending} onClick={() => acceptMutation.mutate()}>
            {t("invitationsPage.accept")}
          </Button>
          <Button
            variant="outline"
            disabled={declineMutation.isPending}
            onClick={() => declineMutation.mutate()}
          >
            {t("invitationsPage.decline")}
          </Button>
        </div>
      )}
    </div>
  );
}
