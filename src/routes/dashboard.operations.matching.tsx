import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, ChevronUp, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { assignRequestToRoute } from "@/lib/queries/routes";
import {
  clusterByDemand,
  listCandidateRoutes,
  listUnmatchedRequests,
  logMatchDecision,
  suggestRoutesForRequest,
  type MatchOutcome,
} from "@/lib/queries/matching";

export const Route = createFileRoute("/dashboard/operations/matching")({
  component: MatchingPage,
});

const outcomeStyles: Record<MatchOutcome, string> = {
  strong_match: "bg-success/15 text-success",
  possible_match: "bg-accent/15 text-accent",
  manual_review: "bg-warning/20 text-foreground",
  blocked: "bg-destructive/10 text-destructive",
};

function MatchingPage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: ["unmatched-requests"],
    queryFn: listUnmatchedRequests,
  });
  const routesQuery = useQuery({ queryKey: ["candidate-routes"], queryFn: listCandidateRoutes });

  const suggestionsQuery = useQuery({
    queryKey: ["match-suggestions", expanded],
    enabled: !!expanded && !!routesQuery.data,
    queryFn: () => {
      const request = requestsQuery.data!.find((r) => r.id === expanded)!;
      return suggestRoutesForRequest(request, routesQuery.data!);
    },
  });

  const proposeMutation = useMutation({
    mutationFn: async ({
      requestId,
      routeId,
      score,
      outcome,
    }: {
      requestId: string;
      routeId: string;
      score: number;
      outcome: MatchOutcome;
    }) => {
      await assignRequestToRoute({ routeId, transportRequestId: requestId });
      await logMatchDecision({
        actorId: userId!,
        requestId,
        routeId,
        action: "proposed",
        score,
        outcome,
      });
    },
    onSuccess: () => {
      toast.success("Proposed assignment created — request added to the route.");
      queryClient.invalidateQueries({ queryKey: ["unmatched-requests"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not propose assignment."),
  });

  const dismissMutation = useMutation({
    mutationFn: (input: {
      requestId: string;
      routeId: string;
      score: number;
      outcome: MatchOutcome;
    }) => logMatchDecision({ actorId: userId!, ...input, action: "dismissed" }),
    onSuccess: () => toast.success("Suggestion dismissed."),
  });

  const clusters = requestsQuery.data ? clusterByDemand(requestsQuery.data) : [];

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">Matching suggestions</h1>
        <p className="text-sm text-muted-foreground">
          Deterministic, explainable suggestions only — every assignment still requires operations
          approval.
        </p>
      </header>

      {clusters.length > 0 && (
        <section className="mb-6 rounded-2xl border border-border/70 bg-card p-5">
          <h3 className="mb-3 font-display text-base font-semibold">
            Unmatched demand by country pair
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {clusters.map((c) => (
              <div
                key={`${c.pickupCountry}-${c.destinationCountry}`}
                className="rounded-lg border border-border/70 p-3 text-sm"
              >
                <div className="font-medium">
                  {c.pickupCountry} → {c.destinationCountry}
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.count} request{c.count === 1 ? "" : "s"} · sizes:{" "}
                  {Array.from(c.animalSizes).join(", ") || "unspecified"}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            A cluster with growing demand may be worth planning a new shared route around — this is
            a suggestion, not an automatic route creation.
          </p>
        </section>
      )}

      <section className="space-y-3">
        {requestsQuery.data?.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border/70 bg-card p-4">
            <button
              type="button"
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <div className="font-medium">
                  {r.request_number} — {r.animal_name ?? "Animal"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.pickup_city ?? r.pickup_country} →{" "}
                  {r.destination_city ?? r.destination_country} ·{" "}
                  {r.requested_service_type.replace("_", " ")}
                </div>
              </div>
              {expanded === r.id ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </button>

            {expanded === r.id && (
              <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
                {suggestionsQuery.isLoading && (
                  <p className="text-sm text-muted-foreground">Scoring routes…</p>
                )}
                {suggestionsQuery.data?.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No planned routes to compare against.
                  </p>
                )}
                {suggestionsQuery.data?.map((s) => {
                  const route = routesQuery.data?.find((route) => route.id === s.routeId);
                  return (
                    <div
                      key={s.routeId}
                      className="rounded-xl border border-border/70 bg-background p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-sm">{route?.route_name ?? s.routeId}</div>
                        <div className="flex items-center gap-2">
                          <Badge className={outcomeStyles[s.outcome]}>
                            {s.outcome.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Score {s.score}</span>
                        </div>
                      </div>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {s.explanation.map((e) => (
                          <li key={e}>· {e}</li>
                        ))}
                        {s.warnings.map((w) => (
                          <li key={w} className="text-warning">
                            ⚠ {w}
                          </li>
                        ))}
                        {s.blockingReasons.map((b) => (
                          <li key={b} className="text-destructive">
                            ✕ {b}
                          </li>
                        ))}
                      </ul>
                      {s.outcome !== "blocked" && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              proposeMutation.mutate({
                                requestId: r.id,
                                routeId: s.routeId,
                                score: s.score,
                                outcome: s.outcome,
                              })
                            }
                            disabled={proposeMutation.isPending}
                          >
                            <CheckCircle2 className="mr-1 size-4" /> Propose assignment
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              dismissMutation.mutate({
                                requestId: r.id,
                                routeId: s.routeId,
                                score: s.score,
                                outcome: s.outcome,
                              })
                            }
                          >
                            <XCircle className="mr-1 size-4" /> Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {requestsQuery.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No unmatched requests right now.</p>
        )}
      </section>
    </div>
  );
}
