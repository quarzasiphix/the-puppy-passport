import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  FileEdit,
  MessageCircle,
  Trash2,
} from "lucide-react";
import { TransportDocumentChecklist } from "@/domains/transport";
import { ReviewTransportDialog } from "@/domains/transport";
import { ChatThread } from "@/domains/messaging";
import { TransportTimeline } from "@/domains/transport";
import { startTransportConversation } from "@/domains/messaging";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { useAuth } from "@/domains/identity";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import {
  deleteDraft,
  getCustomerTimeline,
  isClosed,
  isOnHold,
  listMyDrafts,
  listMyTransportRequests,
  milestoneIndexForStatus,
  nextActionForStatus,
  reviewableStatuses,
  transportMilestones,
} from "@/domains/transport";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/buyer/transport")({
  component: BuyerTransport,
});

function BuyerTransport() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["my-transport-requests", userId],
    enabled: !!userId,
    queryFn: () => listMyTransportRequests(userId!),
  });
  const draftsQuery = useQuery({
    queryKey: ["my-transport-drafts", userId],
    enabled: !!userId,
    queryFn: () => listMyDrafts(userId!),
  });
  const submitted = query.data?.filter((req) => req.status !== "draft") ?? [];

  async function handleDeleteDraft(id: string) {
    try {
      await deleteDraft(id);
      toast.success(t("buyerPanel.transport.draftDeleted"));
      queryClient.invalidateQueries({ queryKey: ["my-transport-drafts", userId] });
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, t("buyerPanel.transport.couldNotDeleteDraft")));
    }
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium">{t("buyerPanel.transport.title")}</h1>
        <Button asChild>
          <Link to="/transport/request">{t("buyerPanel.transport.requestTransport")}</Link>
        </Button>
      </header>

      {draftsQuery.data && draftsQuery.data.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-lg font-semibold">
            {t("buyerPanel.transport.drafts")}
          </h2>
          <div className="space-y-2">
            {draftsQuery.data.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border/70 bg-secondary/30 p-4"
              >
                <div>
                  <div className="font-medium">
                    {d.animal_name || t("buyerPanel.transport.unnamedRequest")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {d.pickup_city ?? "?"} <ArrowRight className="mx-1 inline size-3" />{" "}
                    {d.destination_city ?? "?"} · {t("buyerPanel.transport.savedPrefix")}{" "}
                    {new Date(d.updated_at).toLocaleDateString("en-GB")}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/transport/request" search={{ draft: d.id }}>
                      <FileEdit className="mr-1 size-4" /> {t("buyerPanel.transport.resume")}
                    </Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t("buyerPanel.transport.deleteDraftConfirmTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("buyerPanel.transport.cannotBeUndone")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("buyerPanel.transport.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteDraft(d.id)}>
                          {t("buyerPanel.transport.delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {query.isLoading && (
        <p className="text-sm text-muted-foreground">{t("buyerPanel.transport.loadingRequests")}</p>
      )}
      {query.isError && (
        <p className="text-sm text-destructive">{t("buyerPanel.transport.loadError")}</p>
      )}
      {query.data && submitted.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("buyerPanel.transport.emptyBody")}</p>
          <Button asChild className="mt-4">
            <Link to="/transport/request">{t("buyerPanel.transport.requestTransport")}</Link>
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {submitted.map((req) => {
          const milestone = milestoneIndexForStatus(req.status);
          const statusLabel = isClosed(req.status)
            ? t("buyerPanel.transport.statusClosed")
            : isOnHold(req.status)
              ? t("buyerPanel.transport.statusOnHold")
              : (transportMilestones[milestone ?? 0] ?? req.status);
          return (
            <RequestCard
              key={req.id}
              item={req}
              milestone={milestone}
              statusLabel={statusLabel}
              userId={userId!}
            />
          );
        })}
      </div>
    </div>
  );
}

function RequestCard({
  item,
  milestone,
  statusLabel,
  userId,
}: {
  item: Awaited<ReturnType<typeof listMyTransportRequests>>[number];
  milestone: number | null;
  statusLabel: string;
  userId: string;
}) {
  const { t } = useTranslation();
  const [showDocs, setShowDocs] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const conversationQuery = useQuery({
    queryKey: ["transport-conversation", item.id],
    enabled: showChat,
    queryFn: () => startTransportConversation(item.id),
  });
  const timelineQuery = useQuery({
    queryKey: ["transport-timeline", item.id],
    enabled: showTimeline,
    queryFn: () => getCustomerTimeline(item.id),
  });
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold">{item.request_number}</div>
          <div className="text-sm text-muted-foreground">
            {item.pickup_city ?? item.pickup_country ?? "?"}{" "}
            <ArrowRight className="mx-1 inline size-3" />{" "}
            {item.destination_city ?? item.destination_country ?? "?"}
          </div>
        </div>
        <Badge variant={isOnHold(item.status) ? "destructive" : "secondary"}>{statusLabel}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{nextActionForStatus(item.status)}</p>
      {milestone !== null && !isClosed(item.status) && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {transportMilestones.map((s, i) => (
            <span
              key={s}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${i <= milestone ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
            >
              {i <= milestone && <Check className="size-3" />} {s}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowDocs((v) => !v)}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {t("buyerPanel.transport.documents")}{" "}
          <ChevronDown
            className={`size-3.5 transition-transform ${showDocs ? "rotate-180" : ""}`}
          />
        </button>
        <button
          onClick={() => setShowChat((v) => !v)}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <MessageCircle className="size-3.5" /> {t("buyerPanel.transport.messageOperations")}{" "}
          <ChevronDown
            className={`size-3.5 transition-transform ${showChat ? "rotate-180" : ""}`}
          />
        </button>
        <button
          onClick={() => setShowTimeline((v) => !v)}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Clock3 className="size-3.5" /> {t("buyerPanel.transport.timeline")}{" "}
          <ChevronDown
            className={`size-3.5 transition-transform ${showTimeline ? "rotate-180" : ""}`}
          />
        </button>
        {reviewableStatuses.has(item.status) && (
          <ReviewTransportDialog transportRequestId={item.id} userId={userId} />
        )}
      </div>
      {showDocs && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <TransportDocumentChecklist transportRequestId={item.id} userId={userId} />
        </div>
      )}
      {showChat && (
        <div className="mt-3 border-t border-border/60 pt-3">
          {conversationQuery.data ? (
            <ChatThread conversationId={conversationQuery.data} currentUserId={userId} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("buyerPanel.transport.loading")}</p>
          )}
        </div>
      )}
      {showTimeline && (
        <div className="mt-3 border-t border-border/60 pt-3">
          {timelineQuery.data ? (
            <TransportTimeline events={timelineQuery.data} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("buyerPanel.transport.loading")}</p>
          )}
        </div>
      )}
    </div>
  );
}
