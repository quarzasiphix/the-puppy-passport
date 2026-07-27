import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Plus, UserMinus, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { getMyFoundation } from "@/lib/queries/foundation";
import { getFriendlyErrorMessage } from "@/lib/errors";
import {
  changeOrgMemberRole,
  inviteOrgMember,
  listOrgInvitations,
  listOrgMembers,
  orgMemberRoleLabels,
  removeOrgMember,
  revokeOrgInvitation,
  setOrgMemberStatus,
  type OrgMemberRole,
} from "@/lib/queries/team";

export const Route = createFileRoute("/dashboard/foundation/team")({
  component: TeamPage,
});

const invitableRoles: OrgMemberRole[] = [
  "administrator",
  "adoption_coordinator",
  "transport_coordinator",
  "animal_care_member",
  "volunteer",
];

function TeamPage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgMemberRole>("volunteer");

  const orgQuery = useQuery({
    queryKey: ["my-foundation", userId],
    enabled: !!userId,
    queryFn: () => getMyFoundation(userId!),
  });
  const membersQuery = useQuery({
    queryKey: ["org-members", orgQuery.data?.id],
    enabled: !!orgQuery.data?.id,
    queryFn: () => listOrgMembers(orgQuery.data!.id),
  });
  const invitationsQuery = useQuery({
    queryKey: ["org-invitations", orgQuery.data?.id],
    enabled: !!orgQuery.data?.id,
    queryFn: () => listOrgInvitations(orgQuery.data!.id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["org-members", orgQuery.data?.id] });
    queryClient.invalidateQueries({ queryKey: ["org-invitations", orgQuery.data?.id] });
  };

  const inviteMutation = useMutation({
    mutationFn: () => inviteOrgMember({ orgId: orgQuery.data!.id, email, role }),
    onSuccess: () => {
      toast.success("Invitation sent.");
      setOpen(false);
      setEmail("");
      setRole("volunteer");
      invalidate();
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not invite.")),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeOrgInvitation(id),
    onSuccess: invalidate,
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not revoke.")),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeOrgMember(id),
    onSuccess: () => {
      toast.success("Member removed.");
      invalidate();
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not remove member.")),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: "active" | "suspended" }) =>
      setOrgMemberStatus(input.id, input.status),
    onSuccess: invalidate,
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not update status.")),
  });

  const roleMutation = useMutation({
    mutationFn: (input: { id: string; role: OrgMemberRole }) =>
      changeOrgMemberRole(input.id, input.role),
    onSuccess: invalidate,
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not change role.")),
  });

  const pendingInvitations = invitationsQuery.data?.filter((i) => i.status === "pending") ?? [];

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite volunteers and staff to your organisation and manage their role. Only the
            organisation's owner can invite or manage an administrator.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!orgQuery.data?.id}>
              <Plus className="mr-1 size-4" /> Invite
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite someone to your team</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as OrgMemberRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {invitableRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {orgMemberRoleLabels[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                disabled={!email || inviteMutation.isPending}
                onClick={() => inviteMutation.mutate()}
              >
                Send invitation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {!orgQuery.isLoading && !orgQuery.data && (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Team management is only available to approved foundation, shelter and rescue
            organisations.
          </p>
        </div>
      )}

      {!!pendingInvitations.length && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Pending invitations</h2>
          <div className="space-y-2">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border/70 bg-secondary/30 p-3"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="size-4 text-muted-foreground" />
                  {inv.invited_email}
                  <Badge variant="secondary">{orgMemberRoleLabels[inv.invited_role]}</Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(inv.id)}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Members</h2>
        <div className="space-y-2">
          {membersQuery.data?.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3"
            >
              <div>
                <div className="text-sm font-medium">{m.profiles?.display_name ?? "Member"}</div>
                <div className="text-xs text-muted-foreground">
                  {orgMemberRoleLabels[m.member_role]}
                  {m.status === "suspended" && " · Suspended"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={m.member_role}
                  onValueChange={(v) => roleMutation.mutate({ id: m.id, role: v as OrgMemberRole })}
                  disabled={m.member_role === "owner"}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(orgMemberRoleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {m.member_role !== "owner" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={statusMutation.isPending}
                      onClick={() =>
                        statusMutation.mutate({
                          id: m.id,
                          status: m.status === "active" ? "suspended" : "active",
                        })
                      }
                    >
                      <UserX className="mr-1 size-3.5" />
                      {m.status === "active" ? "Suspend" : "Restore"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(m.id)}
                    >
                      <UserMinus className="mr-1 size-3.5" /> Remove
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
