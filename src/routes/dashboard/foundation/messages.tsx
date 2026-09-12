import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/domains/identity";
import { listMyConversations, type ConversationListRow } from "@/domains/messaging";
import { ChatThread } from "@/domains/messaging";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/foundation/messages")({
  validateSearch: (search: Record<string, unknown>): { conversation?: string } => ({
    conversation: typeof search.conversation === "string" ? search.conversation : undefined,
  }),
  component: FoundationMessages,
});

function threadLabel(
  c: NonNullable<ConversationListRow["conversations"]>,
  currentUserId: string,
  defaultAdopterName: string,
) {
  const other = c.conversation_participants.find((p) => p.profile_id !== currentUserId);
  return {
    title: other?.profiles?.display_name ?? defaultAdopterName,
    subtitle: c.animals?.name ?? "",
  };
}

function FoundationMessages() {
  const { t } = useTranslation();
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
  const defaultAdopterName = t("foundationPanel.messagesPage.defaultAdopterName");

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">
          {t("foundationPanel.messagesPage.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("foundationPanel.messagesPage.subtitle")}
        </p>
      </header>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("foundationPanel.messagesPage.loading")}</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="font-medium">{t("foundationPanel.messagesPage.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("foundationPanel.messagesPage.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl border border-border/70 bg-card">
            <ul className="divide-y divide-border/60">
              {query.data.map((c) => {
                const label = threadLabel(c, userId!, defaultAdopterName);
                return (
                  <li
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`cursor-pointer p-4 hover:bg-secondary/40 ${activeId === c.id ? "bg-secondary/40" : ""}`}
                  >
                    <div className="font-medium">{label.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("foundationPanel.messagesPage.aboutPrefix")} {label.subtitle}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            {active ? (
              <>
                <div className="mb-4 font-display text-lg font-semibold">
                  {threadLabel(active, userId!, defaultAdopterName).title}
                </div>
                <ChatThread conversationId={active.id} currentUserId={userId!} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("foundationPanel.messagesPage.selectConversation")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
