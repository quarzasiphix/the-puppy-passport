import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown, LayoutDashboard, LogOut, Plus, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { useAuth, signOut } from "@/domains/identity";
import { dashboardWorkspaces } from "@/app/config/navigation";
import { useTranslation } from "@/shared/i18n";

// One shared "click my name/avatar" menu for every "top right" spot that shows the signed-in
// user's name — the public site header and every dashboard's own header. Previously the public
// header split this into two separate always-visible controls (a "Dashboard" button + a bare
// logout icon, both `hidden` below lg) and the dashboard headers showed a purely decorative name
// chip with no interaction at all. One control, one place its behavior is defined.
export function UserMenu({
  settingsTo,
  showDashboardLink = false,
  logoUrl,
  hideSignOut = false,
}: {
  /** Route to this workspace's own settings/account page, e.g. "/dashboard/breeder/settings".
   * Omitted entirely (no "Settings" item) when a dashboard has no such page yet. */
  settingsTo?: string;
  /** Show a "Dashboard" item — only on the public site header, where that's the most useful
   * shortcut; redundant (and omitted) inside a dashboard the user is already in. */
  showDashboardLink?: boolean;
  /** The current organisation's own logo (e.g. organisations.logo_url) — shown in the trigger
   * button instead of the user's initials when set, so the button reads as "this kennel" rather
   * than a generic account avatar. Only ever passed by an org-owning dashboard (breeder today). */
  logoUrl?: string | null;
  /** Hides the "Sign out" item — set by a dashboard that puts its own sign-out control somewhere
   * more deliberate (e.g. the bottom of its settings page) so it isn't one accidental tap away
   * from every other menu item here. Defaults to false so every dashboard without its own
   * sign-out control keeps working exactly as before. */
  hideSignOut?: boolean;
}) {
  const { firstName, lastName, roles } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = "/" + pathname.split("/").slice(1, 3).join("/");

  // Same source as the sidebar's WorkspaceSwitcher (dashboard-shell.tsx) — this menu is the one
  // control that's reliably reachable on every screen size (the sidebar switcher is hidden below
  // `lg`), so it doubles as the mobile org/workspace switcher rather than needing its own separate
  // control. "Add new organisation" always shows, regardless of how many workspaces the user
  // already has — a breeder can run more than one kennel.
  const activeRoleNames = new Set(roles.filter((r) => r.status === "active").map((r) => r.role));
  const availableWorkspaces = dashboardWorkspaces.filter(
    (w) => w.roles.length === 0 || w.roles.some((r) => activeRoleNames.has(r)),
  );

  const initials =
    [firstName, lastName]
      .filter(Boolean)
      .map((n) => n![0])
      .join("")
      .toUpperCase() || "?";

  async function handleSignOut() {
    await signOut();
    await queryClient.invalidateQueries({ queryKey: ["auth-state"] });
    await router.invalidate();
    toast.success(t("nav.signedOutToast"));
    await navigate({ to: "/" });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("dashboardShell.profileMenuLabel")}
          className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1 pl-1 pr-2.5 outline-none hover:bg-secondary"
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="size-7 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {initials}
            </span>
          )}
          <span className="text-sm">{firstName ?? t("nav.dashboard")}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {showDashboardLink && (
          <DropdownMenuItem asChild className="gap-2">
            <Link to="/dashboard/buyer">
              <LayoutDashboard className="size-4" /> {t("nav.dashboard")}
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("dashboardShell.switchWorkspaceLabel")}
        </DropdownMenuLabel>
        {availableWorkspaces.map((w) => {
          const active = w.to === current;
          return (
            <DropdownMenuItem key={w.to} asChild className="gap-2">
              <Link to={w.to}>
                <w.icon className="size-4" />
                <span className="flex-1">{t(`dashboardShell.workspaces.${w.id}`)}</span>
                {active && <Check className="size-4 shrink-0 text-primary" />}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuItem asChild className="gap-2">
          <Link to="/create-breeder">
            <Plus className="size-4" /> {t("dashboardShell.addNewOrganisation")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {settingsTo && (
          <DropdownMenuItem asChild className="gap-2">
            <Link to={settingsTo}>
              <Settings className="size-4" /> {t("dashboardShell.settings")}
            </Link>
          </DropdownMenuItem>
        )}
        {!hideSignOut && (
          <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-destructive">
            <LogOut className="size-4" /> {t("nav.signOut")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
