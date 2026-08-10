import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { getMyFoundation } from "@/lib/queries/foundation";
import {
  applicationStatusLabels,
  applicationStatusStyles,
  listApplicationsForOrg,
  respondToApplication,
  type ApplicationStatus,
} from "@/lib/queries/applications";
import { startApplicationConversation } from "@/lib/queries/messaging";
import { createTransportDraftForFoundationAdoption } from "@/lib/queries/transport";
import { getFriendlyErrorMessage } from "@/lib/errors";
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

const applicationTypeLabels: Record<string, string> = {
  adoption: "Adoption",
  rehoming_inquiry: "Rehoming inquiry",
  purchase: "Purchase",
};

function ApplicationsPage() {
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
      toast.success("Applicant notified.");
      queryClient.invalidateQueries({ queryKey: ["foundation-applications", org?.id] });
      setOpenId(null);
      setReply("");
      setInternalNotes("");
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not update.")),
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
      toast.success(
        "A transport draft has been started for this adoption. Find it under Transport requests.",
      );
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, "Could not start a transport draft.")),
  });

  const messageMutation = useMutation({
    mutationFn: () => {
      if (!active) throw new Error("No application selected");
      return startApplicationConversation(active.animal_id, active.buyer_id);
    },
    onSuccess: (conversationId) => {
      navigate({ to: "/dashboard/foundation/messages", search: { conversation: conversationId } });
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not open conversation.")),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Adoption applications</h1>
        <p className="text-sm text-muted-foreground">
          Review and respond to people interested in adopting your animals.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !applications?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="font-medium">No applications yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Applications from people interested in your animals will show up here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4">Applicant</th>
                <th className="p-4">Animal</th>
                <th className="p-4">Type</th>
                <th className="p-4">Location</th>
                <th className="p-4">Date</th>
                <th className="p-4">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {applications.map((a) => (
                <tr key={a.id} className="hover:bg-secondary/40">
                  <td className="p-4">
                    <div className="font-medium">{a.profiles?.display_name ?? "Applicant"}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {a.housing_type === "house" ? "House" : "Apartment"}
                      {a.has_garden ? ", garden" : ""}
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
                      {applicationStatusLabels[a.status]}
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
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  {active.profiles?.display_name ?? "Applicant"}
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {applicationTypeLabels[active.application_type] ?? active.application_type} for{" "}
                  {active.animals?.name ?? "this animal"} ·{" "}
                  {new Date(active.submitted_at).toLocaleDateString("en-GB")}
                </p>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <Field label="Household">
                  {active.housing_type === "house" ? "House" : "Apartment"}
                  {active.has_garden ? ", garden or secure outdoor space" : ""}
                  {active.has_children
                    ? `, children (${active.children_ages || "ages not given"})`
                    : ""}
                  {active.other_animals ? ` — other animals: ${active.other_animals}` : ""}
                  {active.landlord_permission != null &&
                    ` · Landlord permission: ${active.landlord_permission ? "Yes" : "No"}`}
                </Field>
                <Field label="Experience">{active.previous_experience || "Not provided"}</Field>
                <Field label="Breed/species knowledge">
                  {active.breed_knowledge || "Not provided"}
                </Field>
                <Field label="Daily routine">
                  {active.working_schedule && `Work: ${active.working_schedule}. `}
                  {active.alone_time && `Time alone: ${active.alone_time}.`}
                  {!active.working_schedule && !active.alone_time && "Not provided"}
                </Field>
                <Field label="What they're looking for">
                  {active.intended_purpose || "Not provided"}
                </Field>
                <Field label="Veterinary planning">
                  {active.veterinary_plan || "Not provided"}
                </Field>
                <Field label="Collection">
                  {active.collection_method?.replace(/_/g, " ") || "Not specified"}
                  {active.transport_required && " · Interested in Anemalo transport"}
                  {active.preferred_collection_date &&
                    ` · Preferred ${new Date(active.preferred_collection_date).toLocaleDateString("en-GB")}`}
                </Field>
                <Field label="Contact">
                  {active.phone} · {active.buyer_city}, {active.buyer_country}
                </Field>
                <Field label="Message">{active.message || "No message included."}</Field>
                {active.breeder_response && (
                  <Field label="Your previous reply">{active.breeder_response}</Field>
                )}
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Reply (sent with your decision — visible to the applicant)
                  </div>
                  <Textarea
                    rows={4}
                    placeholder="Send a message to the applicant…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Internal notes (never shown to the applicant)
                  </div>
                  <Textarea
                    rows={3}
                    placeholder="Notes for your team only…"
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
                    <Truck className="mr-1 size-4" /> Start a transport request for this adoption
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
                  <MessageCircle className="mr-1 size-4" /> Message applicant
                </Button>
                <Button
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "approved" })}
                >
                  <CheckCircle2 className="mr-1 size-4" /> Approve
                </Button>
                <Button
                  variant="outline"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "rejected" })}
                >
                  <XCircle className="mr-1 size-4" /> Reject
                </Button>
                <Button
                  variant="outline"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "more_info_requested" })}
                >
                  <Info className="mr-1 size-4" /> Request info
                </Button>
                <Button
                  variant="outline"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "call_requested" })}
                >
                  <Phone className="mr-1 size-4" /> Invite to call
                </Button>
                <Button
                  variant="outline"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "interview_planned" })}
                >
                  <CalendarClock className="mr-1 size-4" /> Plan interview
                </Button>
                <Button
                  variant="outline"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ status: "waiting_list" })}
                >
                  <ListPlus className="mr-1 size-4" /> Add to waiting list
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
