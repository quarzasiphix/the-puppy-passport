import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Check, Dog } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useTranslation } from "@/shared/i18n";

// Shared "big, friendly" building blocks for the breeder dashboard (kennel owner panel), modeled
// on the Gryfin York kennel's own real admin panel style (/p/grif/c — panel.*.tsx: big colorful
// action tiles, huge tap targets, button-groups instead of dropdowns, a picker dialog instead of
// an inline status field) so a breeder who already knows that panel finds this one immediately
// familiar. Deliberately scoped to Anemalo's own color tokens (primary/accent/success/warning),
// not a new palette — on-brand, not a copy of Gryfin's magenta/lavender theme.
//
// Used by: dashboard/breeder/index.tsx, puppies.tsx, litters.index.tsx, litters.$id.tsx, and the
// puppy/litter form dialogs in src/domains/animals/components/. Other role dashboards (buyer,
// operations, admin) intentionally keep the denser shadcn-default look — CLAUDE.md's own UX
// principle draws that line ("internal/ops dashboards can stay precise and technical"); this kit
// is for the kennel-owner-facing surfaces only.

export type PanelTone = "primary" | "accent" | "success" | "warning";

const TONE: Record<
  PanelTone,
  { solid: string; soft: string; text: string; ring: string; iconBg: string }
> = {
  primary: {
    solid: "bg-primary text-primary-foreground",
    soft: "bg-primary/10",
    text: "text-primary",
    ring: "border-primary",
    iconBg: "bg-primary/15 text-primary",
  },
  accent: {
    solid: "bg-accent text-accent-foreground",
    soft: "bg-accent/10",
    text: "text-accent",
    ring: "border-accent",
    iconBg: "bg-accent/15 text-accent",
  },
  success: {
    solid: "bg-success text-success-foreground",
    soft: "bg-success/15",
    text: "text-success",
    ring: "border-success",
    iconBg: "bg-success/15 text-success",
  },
  warning: {
    solid: "bg-warning text-warning-foreground",
    soft: "bg-warning/20",
    text: "text-foreground",
    ring: "border-warning",
    iconBg: "bg-warning/25 text-foreground",
  },
};

/** A big, colorful, tappable dashboard shortcut — "Add puppy", "Add litter", etc. */
export function QuickActionTile({
  to,
  search,
  label,
  icon: Icon,
  tone,
}: {
  to: string;
  search?: Record<string, string>;
  label: string;
  icon: LucideIcon;
  tone: PanelTone;
}) {
  return (
    <Link
      to={to}
      search={search}
      className={cn(
        "group relative flex min-h-28 flex-col items-start justify-between gap-5 overflow-hidden rounded-3xl p-4 font-semibold shadow-sm transition active:scale-[0.98]",
        TONE[tone].solid,
      )}
    >
      <span className="absolute -right-4 -top-4 size-16 rounded-full bg-white/15" aria-hidden />
      <span className="absolute -bottom-6 -right-2 size-24 rounded-full bg-white/10" aria-hidden />
      <span className="relative flex size-11 items-center justify-center rounded-2xl bg-white/20">
        <Icon className="size-6" />
      </span>
      <span className="relative text-base leading-tight">{label}</span>
    </Link>
  );
}

/** A big number + label tile for the dashboard summary row. */
export function BigStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: PanelTone;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-3xl p-4", TONE[tone].soft)}>
      <Icon className={cn("absolute -bottom-3 -right-3 size-16 opacity-15", TONE[tone].text)} />
      <p className="relative font-display text-3xl font-bold leading-none">{value}</p>
      <p className="relative mt-2 text-sm font-semibold leading-tight text-foreground/80">
        {label}
      </p>
    </div>
  );
}

/** Replaces a <Select> for a short enum: a row/grid of big toggle buttons, active = filled tone. */
export function ToggleButtonGroup<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
  tone = "primary",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  columns?: 1 | 2 | 3;
  tone?: PanelTone;
}) {
  const cols = columns === 1 ? "grid-cols-1" : columns === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className={cn("grid gap-2", cols)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "h-14 rounded-2xl border-2 px-3 text-base font-bold transition",
              active
                ? `${TONE[tone].ring} ${TONE[tone].soft} ${TONE[tone].text}`
                : "border-border bg-card",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Replaces a <Select> for a longer list needing more context per option (a litter, a parent dog):
 * a full-width selectable card row instead of a cramped dropdown. */
export function PickerCard({
  selected,
  onClick,
  title,
  subtitle,
  icon: Icon,
  tone = "primary",
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  tone?: PanelTone;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition",
        selected ? `${TONE[tone].ring} ${TONE[tone].soft}` : "border-border bg-card",
      )}
    >
      {Icon && (
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl",
            TONE[tone].iconBg,
          )}
        >
          <Icon className="size-6" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {selected && <Check className={cn("size-5 shrink-0", TONE[tone].text)} />}
    </button>
  );
}

/** Step progress bar + "Step N of M · Title" caption for a wizard-style dialog form. `steps` are
 * already-translated titles (the caller owns those, via its own breederPanel.*.step* keys) —
 * only the "Step … of …" wrapper text is translated here. */
export function WizardProgress({ steps, current }: { steps: string[]; current: number }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        {steps.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i <= current ? "bg-primary" : "bg-secondary",
            )}
          />
        ))}
      </div>
      <p className="text-xs font-bold text-primary">
        {t("breederPanel.wizard.stepPrefix")} {current + 1} {t("breederPanel.wizard.ofLabel")}{" "}
        {steps.length} · {steps[current]}
      </p>
    </div>
  );
}

/** Mother-photo-over-father-photo overlapping avatar pair, used wherever a litter is listed
 * (dashboard recent litters, litters list). Falls back to a plain dog-icon tile per parent when no
 * photo is on file — parent_dogs.profile_image_url has no upload UI yet, so this is often unset. */
export function ParentAvatarPair({
  mother,
  father,
}: {
  mother: { profile_image_url: string | null } | null;
  father: { profile_image_url: string | null } | null;
}) {
  return (
    <div className="relative size-16 shrink-0">
      {mother?.profile_image_url ? (
        <img
          src={mother.profile_image_url}
          alt=""
          className="size-16 rounded-2xl border-2 border-card object-cover"
        />
      ) : (
        <div className="grid size-16 place-items-center rounded-2xl border-2 border-card bg-secondary text-muted-foreground">
          <Dog className="size-6" />
        </div>
      )}
      {father?.profile_image_url ? (
        <img
          src={father.profile_image_url}
          alt=""
          className="absolute -bottom-2 -right-2 size-11 rounded-xl border-2 border-card object-cover"
        />
      ) : (
        <div className="absolute -bottom-2 -right-2 grid size-11 place-items-center rounded-xl border-2 border-card bg-secondary text-muted-foreground">
          <Dog className="size-4" />
        </div>
      )}
    </div>
  );
}

// DB enum value → breederPanel.status.* locale key suffix. Explicit maps (not a mechanical
// snake_case→camelCase transform) so an enum value with no translated label yet (draft/adopted/
// unavailable — not breeder-settable from this panel, see puppies.tsx) falls back to readable raw
// text instead of a broken lookup.
const PUPPY_STATUS_KEY: Record<string, string> = {
  available: "available",
  applications_open: "applicationsOpen",
  reserved: "reserved",
  sold: "sold",
  withdrawn: "withdrawn",
};
const LITTER_STATUS_KEY: Record<string, string> = {
  planned: "planned",
  born: "born",
  applications_open: "applicationsOpen",
  fully_reserved: "fullyReserved",
  completed: "completed",
  cancelled: "cancelled",
};

export function puppyStatusLabel(t: (key: string) => string, status: string): string {
  const key = PUPPY_STATUS_KEY[status];
  return key ? t(`breederPanel.status.puppy.${key}`) : status.replace(/_/g, " ");
}

export function litterStatusLabel(t: (key: string) => string, status: string): string {
  const key = LITTER_STATUS_KEY[status];
  return key ? t(`breederPanel.status.litter.${key}`) : status.replace(/_/g, " ");
}

/** Labeled field wrapper with a bigger, bolder label than the default shadcn <FormLabel>. */
export function BigField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold text-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
