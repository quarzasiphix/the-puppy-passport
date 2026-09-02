import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export const Route = createFileRoute("/dashboard/admin/audit-logs")({
  component: AuditLogsPage,
});

type AuditLogRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
  profiles: { display_name: string | null } | null;
};

async function listAuditLogs() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, action, target_type, target_id, created_at, profiles!audit_logs_actor_profile_id_fkey(display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as AuditLogRow[];
}

function AuditLogsPage() {
  const query = useQuery({ queryKey: ["admin-audit-logs"], queryFn: listAuditLogs });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Audit logs</h1>
        <p className="text-sm text-muted-foreground">
          A history of important system changes — role grants, verification decisions, status
          changes. Most recent 200 entries.
        </p>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <ScrollText className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No audit log entries yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {query.data.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("en-GB")}
                  </td>
                  <td className="p-3">{log.profiles?.display_name ?? "System"}</td>
                  <td className="p-3">
                    <Badge variant="secondary" className="capitalize">
                      {log.action.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {log.target_type}
                    {log.target_id && (
                      <span className="font-mono"> · {log.target_id.slice(0, 8)}…</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
