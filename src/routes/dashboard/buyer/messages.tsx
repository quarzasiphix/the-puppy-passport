import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/domains/identity";
import { listMyConversations, type ConversationListRow } from "@/domains/messaging";
import { ChatThread } from "@/domains/messaging";

export const Route = createFileRoute("/dashboard/buyer/messages")({
  validateSearch: (search: Record<string, unknown>): { conversation?: string } => ({
    conversation: typeof search.conversation === "string" ? search.conversation : undefined,
  }),
  component: BuyerMessages,
});

function threadLabel(c: NonNullable<ConversationListRow["conversations"]>, currentUserId: string) {
  if (c.conversation_type === "transport") {
    return {
      title: c.transport_requests?.request_number ?? "Transport",
      subtitle: "Havenpaw operations",
    };
  }
  const other = c.conversation_participants.find((p) => p.profile_id !== currentUserId);
  return {
    title: other?.profiles?.display_name ?? "Breeder",
    subtitle: c.animals?.organisations?.name ?? c.animals?.name ?? "",
  };
}

function BuyerMessages() {
  const { userId } = useAuth();
  const search = Route.useSearch();
  const [activeId, setActiveId] = useState<string | undefined>(search.conversation);

  const query = useQuery({
    queryKey: ["my-conversations", userId],
    enabled: !!userId,
    queryFn: () => listMyConversations(userId!),
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!activeId && query.data?.length) setActiveId(query.data[0].id);
  }, [query.data, activeId]);

  const active = query.data?.find((c) => c.id === activeId);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Messages</h1>
      </header>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="font-medium">No conversations yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once you apply for a puppy, you can message the breeder here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl border border-border/70 bg-card">
            <ul className="divide-y divide-border/60">
              {query.data.map((c) => {
                const label = threadLabel(c, userId!);
                return (
                  <li
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`cursor-pointer p-4 hover:bg-secondary/40 ${activeId === c.id ? "bg-secondary/40" : ""}`}
                  >
                    <div className="font-medium">{label.title}</div>
                    <div className="text-xs text-muted-foreground">{label.subtitle}</div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            {active ? (
              <>
                <div className="mb-4 font-display text-lg font-semibold">
                  {threadLabel(active, userId!).title}
                </div>
                <ChatThread conversationId={active.id} currentUserId={userId!} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a conversation.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
