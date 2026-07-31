import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dog, HeartHandshake, ArrowUpRight } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dashboard/admin/")({
  component: AdminOverview,
});

function AdminKpiSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-6">
      <Skeleton className="size-10 rounded-xl" />
      <div className="flex-1">
        <Skeleton className="h-7 w-10" />
        <Skeleton className="mt-2 h-4 w-40" />
      </div>
    </div>
  );
}

function AdminOverview() {
  const query = useQuery({
    queryKey: ["admin-pending-verifications"],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const [breeder, org] = await Promise.all([
        supabase
          .from("user_verifications")
          .select("*", { count: "exact", head: true })
          .eq("verification_type", "breeder")
          .eq("status", "pending"),
        supabase
          .from("user_verifications")
          .select("*", { count: "exact", head: true })
          .eq("verification_type", "organisation")
          .eq("status", "pending"),
      ]);
      return { breederPending: breeder.count ?? 0, orgPending: org.count ?? 0 };
    },
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Admin overview</h1>
        <p className="text-sm text-muted-foreground">
          Real pending-review counts from the database.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {query.isLoading ? (
          <>
            <AdminKpiSkeleton />
            <AdminKpiSkeleton />
          </>
        ) : (
          <>
            <Link
              to="/dashboard/admin/breeder-verification"
              className="flex items-center justify-between rounded-2xl border border-border/70 bg-card p-6 transition-colors hover:bg-secondary/40"
            >
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Dog className="size-5" />
                </div>
                <div>
                  <div className="font-display text-2xl font-semibold">
                    {query.data?.breederPending ?? "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">Breeder applications pending</div>
                </div>
              </div>
              <ArrowUpRight className="size-4 text-muted-foreground" />
            </Link>
            <Link
              to="/dashboard/admin/foundation-verification"
              className="flex items-center justify-between rounded-2xl border border-border/70 bg-card p-6 transition-colors hover:bg-secondary/40"
            >
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <HeartHandshake className="size-5" />
                </div>
                <div>
                  <div className="font-display text-2xl font-semibold">
                    {query.data?.orgPending ?? "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Foundation/shelter applications pending
                  </div>
                </div>
              </div>
              <ArrowUpRight className="size-4 text-muted-foreground" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
