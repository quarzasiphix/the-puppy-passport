import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import {
  getMyKennel,
  listKennelLitters,
  ParentAvatarPair,
  type LitterRow,
} from "@/domains/breeders";
import { LitterFormDialog } from "@/domains/animals";

export const Route = createFileRoute("/dashboard/breeder/litters/")({
  component: LittersPage,
});

type LitterStatus = LitterRow["status"];

const TABS: {
  key: "active" | "planned" | "completed";
  label: string;
  match: (s: LitterStatus) => boolean;
}[] = [
  {
    key: "active",
    label: "Active",
    match: (s) => s === "born" || s === "applications_open" || s === "fully_reserved",
  },
  { key: "planned", label: "Planned", match: (s) => s === "planned" },
  { key: "completed", label: "Completed", match: (s) => s === "completed" || s === "cancelled" },
];

function LittersPage() {
  const { userId } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("active");
  const active = TABS.find((t) => t.key === tab)!;

  const { data: kennel } = useQuery({
    queryKey: ["my-kennel", userId],
    enabled: !!userId,
    queryFn: () => getMyKennel(userId!),
  });
  const { data: litters, isLoading } = useQuery({
    queryKey: ["kennel-litters", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listKennelLitters(kennel!.id),
  });

  const filtered = (litters ?? []).filter((l) => active.match(l.status));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Litters</h1>
        <p className="text-sm text-muted-foreground">Manage current and planned litters.</p>
      </header>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-secondary p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`h-12 rounded-xl text-sm font-bold transition ${
              tab === t.key ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {kennel?.id && (
        <div className="grid gap-2 sm:grid-cols-2">
          <LitterFormDialog
            kennelId={kennel.id}
            defaultStatus="planned"
            trigger={
              <Button
                variant="outline"
                className="h-14 w-full rounded-2xl border-2 text-base font-bold"
              >
                Add a planned litter
              </Button>
            }
          />
          <LitterFormDialog
            kennelId={kennel.id}
            defaultStatus="born"
            trigger={
              <Button className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold shadow-sm">
                <Plus className="size-5" /> Add a litter
              </Button>
            }
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !filtered.length ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-base font-semibold">
            {!litters?.length
              ? "No litters yet. Add a planned litter to start tracking it."
              : "No litters in this group yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((l) => (
            <Link
              key={l.id}
              to="/dashboard/breeder/litters/$id"
              params={{ id: l.id }}
              className="block overflow-hidden rounded-3xl bg-card shadow-sm transition hover:shadow-md"
            >
              <div className="flex gap-3 p-4">
                <ParentAvatarPair mother={l.mother} father={l.father} />
                <div className="min-w-0 flex-1 pl-1">
                  <h3 className="truncate font-display text-lg font-bold leading-tight">
                    {l.code}
                  </h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.mother?.registered_name ?? "Mother not set"} ×{" "}
                    {l.father?.registered_name ?? "Father not set"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="capitalize">
                      {l.status.replace(/_/g, " ")}
                    </Badge>
                    {!l.is_published && <Badge variant="outline">Draft</Badge>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 border-t border-border/60 bg-secondary/40 px-4 py-3 text-xs">
                <div>
                  <p className="text-muted-foreground">{l.birth_date ? "Born" : "Expected"}</p>
                  <p className="font-bold">
                    {(l.birth_date ?? l.expected_birth_date)
                      ? new Date((l.birth_date ?? l.expected_birth_date)!).toLocaleDateString(
                          "en-GB",
                        )
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Puppies</p>
                  <p className="font-bold">
                    {l.totalPuppies || l.puppy_count || "—"}{" "}
                    {l.totalPuppies > 0 && (
                      <span className="font-normal text-muted-foreground">
                        ({l.availablePuppies} avail)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Breed</p>
                  <p className="truncate font-bold">{l.breeds?.name ?? "—"}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
