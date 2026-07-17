import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { listConversationMessages, sendMessage } from "@/lib/queries/messaging";

export function ChatThread({
  conversationId,
  currentUserId,
}: {
  conversationId: string;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: () => listConversationMessages(conversationId),
    refetchInterval: 5000,
  });

  const mutation = useMutation({
    mutationFn: () => sendMessage({ conversationId, senderId: currentUserId, body: draft.trim() }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send."),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [query.data?.length]);

  return (
    <div>
      <div className="mb-4 h-96 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-secondary/30 p-4 text-sm">
        {query.isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !query.data?.length ? (
          <p className="text-muted-foreground">No messages yet — say hello.</p>
        ) : (
          query.data.map((m) => (
            <Bubble key={m.id} side={m.sender_profile_id === currentUserId ? "you" : "them"}>
              {m.body}
            </Bubble>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) mutation.mutate();
        }}
      >
        <Textarea
          placeholder="Write a message…"
          rows={2}
          className="flex-1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" disabled={mutation.isPending || !draft.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}

function Bubble({ side, children }: { side: "you" | "them"; children: React.ReactNode }) {
  return (
    <div className={`flex ${side === "you" ? "justify-end" : ""}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 ${side === "you" ? "bg-primary text-primary-foreground" : "bg-background border border-border/70"}`}
      >
        {children}
      </div>
    </div>
  );
}
