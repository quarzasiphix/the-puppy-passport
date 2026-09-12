import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Textarea } from "@/shared/ui/textarea";
import { useAuth } from "@/domains/identity";
import { getMyKennel } from "@/domains/breeders";
import {
  getApplicationStatusLabels,
  applicationStatusStyles,
  listApplicationsForOrg,
  respondToApplication,
  type ApplicationStatus,
} from "@/domains/marketplace";
import { startApplicationConversation } from "@/domains/messaging";
import { convertApplicationToReservation } from "@/lib/queries/reservations";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import {
  CheckCircle2,
  XCircle,
  Info,
  Phone,
  ListPlus,
  MessageCircle,
  BadgeCheck,
} from "lucide-react";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/breeder/applications")({
  component: ApplicationsPage,
});

function getCollectionLabels(t: (key: string) => string): Record<string, string> {
  return {
    pickup: t("breederPanel.applications.collectFromBreeder"),
    domestic_transport: t("breederPanel.applications.domesticTransport"),
    international_transport: t("breederPanel.applications.internationalTransport"),
  };
}

function ApplicationsPage() {
  const { t } = useTranslation();
  const collectionLabels = getCollectionLabels(t);
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const { data: kennel } = useQuery({
    queryKey: ["my-kennel", userId],
    enabled: !!userId,
    queryFn: () => getMyKennel(userId!),
  });
  const { data: applications, isLoading } = useQuery({
    queryKey: ["kennel-applications", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listApplicationsForOrg(kennel!.id),
  });

  const active = applications?.find((a) => a.id === openId);

  const respondMutation = useMutation({
    mutationFn: (params: { status: ApplicationStatus }) => {
      if (!active) throw new Error("No application selected");
      return respondToApplication({
        id: active.id,
        status: params.status,
        breederResponse: reply || null,
        buyerId: active.buyer_id,
        animalName: active.animals?.name ?? t("breederPanel.applications.yourListing"),
      });
    },
    onSuccess: () => {
      toast.success(t("breederPanel.applications.buyerNotified"));
      queryClient.invalidateQueries({ queryKey: ["kennel-applications", kennel?.id] });
      setOpenId(null);
      setReply("");
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, t("breederPanel.applications.couldNotUpdate"))),
  });

  const messageMutation = useMutation({
    mutationFn: () => {
      if (!active) throw new Error("No application selected");
      return startApplicationConversation(active.animal_id, active.buyer_id);
    },
    onSuccess: (conversationId) => {
      navigate({ to: "/dashboard/breeder/messages", search: { conversation: conversationId } });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("breederPanel.applications.couldNotOpenConversation"))),
  });

  const reserveMutation = useMutation({
    mutationFn: () => {
      if (!active) throw new Error("No application selected");
      return convertApplicationToReservation({ applicationId: active.id });
    },
    onSuccess: () => {
      toast.success(t("breederPanel.applications.reservationCreated"));
      queryClient.invalidateQueries({ queryKey: ["kennel-applications", kennel?.id] });
      setOpenId(null);
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("breederPanel.applications.couldNotCreateReservation"))),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">{t("breederPanel.applications.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("breederPanel.applications.subtitle")}</p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("breederPanel.applications.loading")}</p>
      ) : !applications?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="font-medium">{t("breederPanel.applications.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("breederPanel.applications.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4">{t("breederPanel.applications.colBuyer")}</th>
                  <th className="p-4">{t("breederPanel.applications.colPuppy")}</th>
                  <th className="p-4">{t("breederPanel.applications.colLocation")}</th>
                  <th className="p-4">{t("breederPanel.applications.colPurpose")}</th>
                  <th className="p-4">{t("breederPanel.applications.colCollection")}</th>
                  <th className="p-4">{t("breederPanel.applications.colDate")}</th>
                  <th className="p-4">{t("breederPanel.applications.colStatus")}</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {applications.map((a) => (
                  <tr key={a.id} className="hover:bg-secondary/40">
                    <td className="p-4">
                      <div className="font-medium">
                        {a.profiles?.display_name ?? t("breederPanel.applications.buyer")}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {a.housing_type === "house"
                          ? t("breederPanel.applications.house")
                          : t("breederPanel.applications.apartment")}
                        {a.has_garden ? `, ${t("breederPanel.applications.gardenSuffix")}` : ""}
                      </div>
                    </td>
                    <td className="p-4">{a.animals?.name ?? "—"}</td>
                    <td className="p-4 text-muted-foreground">
                      {a.buyer_city}, {a.buyer_country}
                    </td>
                    <td className="p-4">{a.intended_purpose ?? "—"}</td>
                    <td className="p-4">
                      {a.collection_method ? collectionLabels[a.collection_method] : "—"}
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
                      <Button size="sm" variant="outline" onClick={() => setOpenId(a.id)}>
                        {t("breederPanel.applications.open")}
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
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-2xl">
                  {active.profiles?.display_name ?? t("breederPanel.applications.buyer")}
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {t("breederPanel.applications.applicationForPrefix")}{" "}
                  {active.animals?.name ?? t("breederPanel.applications.thisPuppy")} ·{" "}
                  {new Date(active.submitted_at).toLocaleDateString("en-GB")}
                </p>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <Field label={t("breederPanel.applications.fieldHousehold")}>
                  {active.housing_type === "house"
                    ? t("breederPanel.applications.house")
                    : t("breederPanel.applications.apartment")}
                  {active.has_garden ? `, ${t("breederPanel.applications.gardenOrOutdoor")}` : ""}
                  {active.has_children
                    ? `, ${t("breederPanel.applications.childrenPrefix")} (${active.children_ages || t("breederPanel.applications.agesNotGiven")})`
                    : ""}
                  {active.other_animals
                    ? ` — ${t("breederPanel.applications.otherAnimalsPrefix")} ${active.other_animals}`
                    : ""}
                </Field>
                <Field label={t("breederPanel.applications.fieldDogExperience")}>
                  {active.previous_experience || t("breederPanel.applications.notProvided")}
                  {active.breed_knowledge
                    ? ` · ${t("breederPanel.applications.breedKnowledgePrefix")} ${active.breed_knowledge}`
                    : ""}
                </Field>
                <Field label={t("breederPanel.applications.fieldWorkingSchedule")}>
                  {active.working_schedule || t("breederPanel.applications.notProvided")}
                  {active.alone_time
                    ? ` · ${t("breederPanel.applications.aloneTimePrefix")} ${active.alone_time}`
                    : ""}
                </Field>
                <Field label={t("breederPanel.applications.fieldIntendedPurpose")}>
                  {active.intended_purpose || t("breederPanel.applications.notProvided")}
                </Field>
                <Field label={t("breederPanel.applications.colCollection")}>
                  {active.collection_method
                    ? collectionLabels[active.collection_method]
                    : t("breederPanel.applications.notProvided")}
                  {active.preferred_collection_date
                    ? ` — ${t("breederPanel.applications.fromPrefix")} ${new Date(active.preferred_collection_date).toLocaleDateString("en-GB")}`
                    : ""}
                </Field>
                <Field label={t("breederPanel.applications.fieldContact")}>
                  {active.phone} · {active.buyer_city}, {active.buyer_country}
                </Field>
                <Field label={t("breederPanel.applications.fieldMessage")}>
                  {active.message || t("breederPanel.applications.noMessageIncluded")}
                </Field>
                {active.breeder_response && (
                  <Field label={t("breederPanel.applications.fieldYourPreviousReply")}>
                    {active.breeder_response}
                  </Field>
                )}
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("breederPanel.applications.replyLabel")}
                  </div>
                  <Textarea
                    rows={4}
                    placeholder={t("breederPanel.applications.replyPlaceholder")}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                </div>
              </div>
              {active.status === "approved" && (
                <div className="mt-4 rounded-xl border border-success/30 bg-success/10 p-4">
                  <p className="text-sm font-medium">
                    {t("breederPanel.applications.readyToReserve")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("breederPanel.applications.reserveExplainPrefix")}{" "}
                    {active.animals?.name ?? t("breederPanel.applications.thisPuppy")}{" "}
                    {t("breederPanel.applications.reserveExplainSuffix")}
                  </p>
                  <Button
                    className="mt-3 w-full"
                    disabled={reserveMutation.isPending}
                    onClick={() => reserveMutation.mutate()}
                  >
                    <BadgeCheck className="mr-1 size-4" /> {t("breederPanel.applications.markReserved")}
                  </Button>
                </div>
              )}
              <div className="mt-6 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="col-span-2"
                  disabled={messageMutation.isPending}
                  onClick={() => messageMutation.mutate()}
                >
                  <MessageCircle className="mr-1 size-4" /> {t("breederPanel.applications.messageBuyer")}
                </Button>
                <Button
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "approved" })}
                >
                  <CheckCircle2 className="mr-1 size-4" /> {t("breederPanel.applications.approve")}
                </Button>
                <Button
                  variant="outline"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "rejected" })}
                >
                  <XCircle className="mr-1 size-4" /> {t("breederPanel.applications.reject")}
                </Button>
                <Button
                  variant="outline"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "more_info_requested" })}
                >
                  <Info className="mr-1 size-4" /> {t("breederPanel.applications.requestInfo")}
                </Button>
                <Button
                  variant="outline"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "call_requested" })}
                >
                  <Phone className="mr-1 size-4" /> {t("breederPanel.applications.inviteToCall")}
                </Button>
                <Button
                  variant="outline"
                  className="col-span-2"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "waiting_list" })}
                >
                  <ListPlus className="mr-1 size-4" /> {t("breederPanel.applications.addToWaitingList")}
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
