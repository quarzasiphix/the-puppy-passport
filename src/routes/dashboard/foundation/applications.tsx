import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Textarea } from "@/shared/ui/textarea";
import { useAuth } from "@/domains/identity";
import { getMyFoundation } from "@/domains/breeders";
import {
  getApplicationStatusLabels,
  applicationStatusStyles,
  listApplicationsForOrg,
  respondToApplication,
  type ApplicationStatus,
} from "@/domains/marketplace";
import { startApplicationConversation } from "@/domains/messaging";
import { createTransportDraftForFoundationAdoption } from "@/domains/transport";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";
import {
  CheckCircle2,
  XCircle,
  Info,
  Phone,
  ListPlus,
  MessageCircle,
  CalendarClock,
  Truck,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/foundation/applications")({
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const { t } = useTranslation();
  const applicationTypeLabels: Record<string, string> = {
    adoption: t("foundationPanel.applications.typeAdoption"),
    rehoming_inquiry: t("foundationPanel.applications.typeRehomingInquiry"),
    purchase: t("foundationPanel.applications.typePurchase"),
  };
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const { data: org } = useQuery({
    queryKey: ["my-foundation", userId],
    enabled: !!userId,
    queryFn: () => getMyFoundation(userId!),
  });
  const { data: applications, isLoading } = useQuery({
    queryKey: ["foundation-applications", org?.id],
    enabled: !!org?.id,
    queryFn: () => listApplicationsForOrg(org!.id),
  });

  const active = applications?.find((a) => a.id === openId);

  const respondMutation = useMutation({
    mutationFn: (params: { status: ApplicationStatus }) => {
      if (!active) throw new Error("No application selected");
      return respondToApplication({
        id: active.id,
        status: params.status,
        breederResponse: reply || null,
        internalNotes: internalNotes || null,
        buyerId: active.buyer_id,
        animalName: active.animals?.name ?? "your listing",
      });
    },
    onSuccess: () => {
      toast.success(t("foundationPanel.applications.applicantNotifiedToast"));
      queryClient.invalidateQueries({ queryKey: ["foundation-applications", org?.id] });
      setOpenId(null);
      setReply("");
      setInternalNotes("");
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("foundationPanel.applications.updateFailed"))),
  });

  const transportMutation = useMutation({
    mutationFn: () => {
      if (!active) throw new Error("No application selected");
      return createTransportDraftForFoundationAdoption({
        animalId: active.animal_id,
        adopterProfileId: active.buyer_id,
      });
    },
    onSuccess: () => {
      toast.success(t("foundationPanel.applications.transportStartedToast"));
    },
    onError: (err) =>
      toast.error(
        getFriendlyErrorMessage(err, t("foundationPanel.applications.transportStartFailed")),
      ),
  });

  const messageMutation = useMutation({
    mutationFn: () => {
      if (!active) throw new Error("No application selected");
      return startApplicationConversation(active.animal_id, active.buyer_id);
    },
    onSuccess: (conversationId) => {
      navigate({ to: "/dashboard/foundation/messages", search: { conversation: conversationId } });
    },
    onError: (err) =>
      toast.error(
        getFriendlyErrorMessage(err, t("foundationPanel.applications.conversationFailed")),
      ),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">
          {t("foundationPanel.applications.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("foundationPanel.applications.subtitle")}
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("foundationPanel.applications.loading")}</p>
      ) : !applications?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="font-medium">{t("foundationPanel.applications.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("foundationPanel.applications.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4">{t("foundationPanel.applications.colApplicant")}</th>
                  <th className="p-4">{t("foundationPanel.applications.colAnimal")}</th>
                  <th className="p-4">{t("foundationPanel.applications.colType")}</th>
                  <th className="p-4">{t("foundationPanel.applications.colLocation")}</th>
                  <th className="p-4">{t("foundationPanel.applications.colDate")}</th>
                  <th className="p-4">{t("foundationPanel.applications.colStatus")}</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {applications.map((a) => (
                  <tr key={a.id} className="hover:bg-secondary/40">
                    <td className="p-4">
                      <div className="font-medium">
                        {a.profiles?.display_name ??
                          t("foundationPanel.applications.defaultApplicant")}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {a.housing_type === "house"
                          ? t("foundationPanel.applications.house")
                          : t("foundationPanel.applications.apartment")}
                        {a.has_garden ? t("foundationPanel.applications.gardenSuffix") : ""}
                      </div>
                    </td>
                    <td className="p-4">{a.animals?.name ?? "—"}</td>
                    <td className="p-4">
                      {applicationTypeLabels[a.application_type] ?? a.application_type}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {a.buyer_city}, {a.buyer_country}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(a.submitted_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="p-4">
                      <Badge className={applicationStatusStyles[a.status]}>
                        {getApplicationStatusLabels(t)[a.status]}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOpenId(a.id);
                          setInternalNotes(a.internal_notes ?? "");
                        }}
                      >
                        {t("foundationPanel.applications.openButton")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Sheet
        open={!!active}
        onOpenChange={(v) => {
          if (!v) {
            setOpenId(null);
            setReply("");
            setInternalNotes("");
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-2xl">
                  {active.profiles?.display_name ??
                    t("foundationPanel.applications.defaultApplicant")}
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {applicationTypeLabels[active.application_type] ?? active.application_type}{" "}
                  {t("foundationPanel.applications.forPrefix")}{" "}
                  {active.animals?.name ?? t("foundationPanel.applications.thisAnimal")} ·{" "}
                  {new Date(active.submitted_at).toLocaleDateString("en-GB")}
                </p>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <Field label={t("foundationPanel.applications.fieldHousehold")}>
                  {active.housing_type === "house"
                    ? t("foundationPanel.applications.house")
                    : t("foundationPanel.applications.apartment")}
                  {active.has_garden ? t("foundationPanel.applications.gardenOrOutdoor") : ""}
                  {active.has_children
                    ? `${t("foundationPanel.applications.childrenPrefix")} (${active.children_ages || t("foundationPanel.applications.agesNotGiven")})`
                    : ""}
                  {active.other_animals
                    ? `${t("foundationPanel.applications.otherAnimalsPrefix")} ${active.other_animals}`
                    : ""}
                  {active.landlord_permission != null &&
                    `${t("foundationPanel.applications.landlordPermissionPrefix")} ${active.landlord_permission ? t("foundationPanel.applications.yes") : t("foundationPanel.applications.no")}`}
                </Field>
                <Field label={t("foundationPanel.applications.fieldExperience")}>
                  {active.previous_experience || t("foundationPanel.applications.notProvided")}
                </Field>
                <Field label={t("foundationPanel.applications.fieldBreedKnowledge")}>
                  {active.breed_knowledge || t("foundationPanel.applications.notProvided")}
                </Field>
                <Field label={t("foundationPanel.applications.fieldDailyRoutine")}>
                  {active.working_schedule &&
                    `${t("foundationPanel.applications.workPrefix")} ${active.working_schedule}. `}
                  {active.alone_time &&
                    `${t("foundationPanel.applications.aloneTimePrefix")} ${active.alone_time}.`}
                  {!active.working_schedule &&
                    !active.alone_time &&
                    t("foundationPanel.applications.notProvided")}
                </Field>
                <Field label={t("foundationPanel.applications.fieldLookingFor")}>
                  {active.intended_purpose || t("foundationPanel.applications.notProvided")}
                </Field>
                <Field label={t("foundationPanel.applications.fieldVetPlanning")}>
                  {active.veterinary_plan || t("foundationPanel.applications.notProvided")}
                </Field>
                <Field label={t("foundationPanel.applications.fieldCollection")}>
                  {active.collection_method?.replace(/_/g, " ") ||
                    t("foundationPanel.applications.notSpecified")}
                  {active.transport_required &&
                    t("foundationPanel.applications.interestedInTransport")}
                  {active.preferred_collection_date &&
                    `${t("foundationPanel.applications.preferredPrefix")} ${new Date(active.preferred_collection_date).toLocaleDateString("en-GB")}`}
                </Field>
                <Field label={t("foundationPanel.applications.fieldContact")}>
                  {active.phone} · {active.buyer_city}, {active.buyer_country}
                </Field>
                <Field label={t("foundationPanel.applications.fieldMessage")}>
                  {active.message || t("foundationPanel.applications.noMessageIncluded")}
                </Field>
                {active.breeder_response && (
                  <Field label={t("foundationPanel.applications.fieldYourPreviousReply")}>
                    {active.breeder_response}
                  </Field>
                )}
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("foundationPanel.applications.replyLabel")}
                  </div>
                  <Textarea
                    rows={4}
                    placeholder={t("foundationPanel.applications.replyPlaceholder")}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("foundationPanel.applications.internalNotesLabel")}
                  </div>
                  <Textarea
                    rows={3}
                    placeholder={t("foundationPanel.applications.internalNotesPlaceholder")}
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                  />
                </div>
                {active.status === "approved" && active.application_type === "adoption" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={transportMutation.isPending}
                    onClick={() => transportMutation.mutate()}
                  >
                    <Truck className="mr-1 size-4" />{" "}
                    {t("foundationPanel.applications.startTransportButton")}
                  </Button>
                )}
              </div>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="col-span-2"
                  disabled={messageMutation.isPending}
                  onClick={() => messageMutation.mutate()}
                >
                  <MessageCircle className="mr-1 size-4" />{" "}
                  {t("foundationPanel.applications.messageApplicantButton")}
                </Button>
                <Button
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "approved" })}
                >
                  <CheckCircle2 className="mr-1 size-4" />{" "}
                  {t("foundationPanel.applications.approveButton")}
                </Button>
                <Button
                  variant="outline"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "rejected" })}
                >
                  <XCircle className="mr-1 size-4" />{" "}
                  {t("foundationPanel.applications.rejectButton")}
                </Button>
                <Button
                  variant="outline"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "more_info_requested" })}
                >
                  <Info className="mr-1 size-4" />{" "}
                  {t("foundationPanel.applications.requestInfoButton")}
                </Button>
                <Button
                  variant="outline"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "call_requested" })}
                >
                  <Phone className="mr-1 size-4" />{" "}
                  {t("foundationPanel.applications.inviteToCallButton")}
                </Button>
                <Button
                  variant="outline"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "interview_planned" })}
                >
                  <CalendarClock className="mr-1 size-4" />{" "}
                  {t("foundationPanel.applications.planInterviewButton")}
                </Button>
                <Button
                  variant="outline"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "waiting_list" })}
                >
                  <ListPlus className="mr-1 size-4" />{" "}
                  {t("foundationPanel.applications.addToWaitingListButton")}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
