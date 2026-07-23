import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, ChevronDown, FileEdit, MessageCircle, Trash2 } from "lucide-react";
import { TransportDocumentChecklist } from "@/components/transport-document-checklist";
import { ReviewTransportDialog } from "@/components/review-transport-dialog";
import { ChatThread } from "@/components/chat-thread";
import { startTransportConversation } from "@/lib/queries/messaging";
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
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  deleteDraft,
  isClosed,
  isOnHold,
  listMyDrafts,
  listMyTransportRequests,
  milestoneIndexForStatus,
  nextActionForStatus,
  reviewableStatuses,
  transportMilestones,
} from "@/lib/queries/transport";
import { useTranslation } from "@/lib/i18n";
import { formatDate } from "@/lib/presentation/date";

export const Route = createFileRoute("/dashboard/buyer/transport")({
  component: BuyerTransport,
});

function BuyerTransport() {
  const { userId } = useAuth();
  const { locale } = useTranslation();
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
  const submitted = query.data?.filter((t) => t.status !== "draft") ?? [];

  async function handleDeleteDraft(id: string) {
    try {
      await deleteDraft(id);
      toast.success("Draft deleted.");
      queryClient.invalidateQueries({ queryKey: ["my-transport-drafts", userId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete draft.");
    }
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium">Transport</h1>
        <Button asChild>
          <Link to="/transport/request">Request transport</Link>
        </Button>
      </header>

      {draftsQuery.data && draftsQuery.data.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Drafts</h2>
          <div className="space-y-2">
            {draftsQuery.data.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border/70 bg-secondary/30 p-4"
              >
                <div>
                  <div className="font-medium">{d.animal_name || "Unnamed request"}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.pickup_city ?? "?"} <ArrowRight className="mx-1 inline size-3" />{" "}
                    {d.destination_city ?? "?"} · Saved {formatDate(d.updated_at, locale)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/transport/request" search={{ draft: d.id }}>
                      <FileEdit className="mr-1 size-4" /> Resume
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
                        <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                        <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteDraft(d.id)}>
                          Delete
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
        <p className="text-sm text-muted-foreground">Loading your transport requests…</p>
      )}
      {query.isError && (
        <p className="text-sm text-destructive">
          Could not load your transport requests. Please try again.
        </p>
      )}
      {query.data && submitted.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            You haven't submitted a transport request yet.
          </p>
          <Button asChild className="mt-4">
            <Link to="/transport/request">Request transport</Link>
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {submitted.map((t) => {
          const milestone = milestoneIndexForStatus(t.status);
          const statusLabel = isClosed(t.status)
            ? "Closed"
            : isOnHold(t.status)
              ? "On hold — action needed"
              : (transportMilestones[milestone ?? 0] ?? t.status);
          return (
            <RequestCard
              key={t.id}
              t={t}
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
  t,
  milestone,
  statusLabel,
  userId,
}: {
  t: Awaited<ReturnType<typeof listMyTransportRequests>>[number];
  milestone: number | null;
  statusLabel: string;
  userId: string;
}) {
  const [showDocs, setShowDocs] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const conversationQuery = useQuery({
    queryKey: ["transport-conversation", t.id],
    enabled: showChat,
    queryFn: () => startTransportConversation(t.id),
  });
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold">{t.request_number}</div>
          <div className="text-sm text-muted-foreground">
            {t.pickup_city ?? t.pickup_country ?? "?"} <ArrowRight className="mx-1 inline size-3" />{" "}
            {t.destination_city ?? t.destination_country ?? "?"}
          </div>
        </div>
        <Badge variant={isOnHold(t.status) ? "destructive" : "secondary"}>{statusLabel}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{nextActionForStatus(t.status)}</p>
      {milestone !== null && !isClosed(t.status) && (
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
          Documents{" "}
          <ChevronDown
            className={`size-3.5 transition-transform ${showDocs ? "rotate-180" : ""}`}
          />
        </button>
        <button
          onClick={() => setShowChat((v) => !v)}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <MessageCircle className="size-3.5" /> Message operations{" "}
          <ChevronDown
            className={`size-3.5 transition-transform ${showChat ? "rotate-180" : ""}`}
          />
        </button>
        {reviewableStatuses.has(t.status) && (
          <ReviewTransportDialog transportRequestId={t.id} userId={userId} />
        )}
      </div>
      {showDocs && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <TransportDocumentChecklist transportRequestId={t.id} userId={userId} />
        </div>
      )}
      {showChat && (
        <div className="mt-3 border-t border-border/60 pt-3">
          {conversationQuery.data ? (
            <ChatThread conversationId={conversationQuery.data} currentUserId={userId} />
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </div>
      )}
    </div>
  );
}
