import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, LayoutDashboard, LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { useAuth, signOut } from "@/domains/identity";
import { useTranslation } from "@/shared/i18n";

// One shared "click my name/avatar" menu for every "top right" spot that shows the signed-in
// user's name — the public site header and every dashboard's own header. Previously the public
// header split this into two separate always-visible controls (a "Dashboard" button + a bare
// logout icon, both `hidden` below lg) and the dashboard headers showed a purely decorative name
// chip with no interaction at all. One control, one place its behavior is defined.
export function UserMenu({
  settingsTo,
  showDashboardLink = false,
}: {
  /** Route to this workspace's own settings/account page, e.g. "/dashboard/breeder/settings".
   * Omitted entirely (no "Settings" item) when a dashboard has no such page yet. */
  settingsTo?: string;
  /** Show a "Dashboard" item — only on the public site header, where that's the most useful
   * shortcut; redundant (and omitted) inside a dashboard the user is already in. */
  showDashboardLink?: boolean;
}) {
  const { firstName, lastName } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

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
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
            {initials}
          </span>
          <span className="text-sm">{firstName ?? t("nav.dashboard")}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {showDashboardLink && (
          <DropdownMenuItem asChild className="gap-2">
            <Link to="/dashboard/buyer">
              <LayoutDashboard className="size-4" /> {t("nav.dashboard")}
            </Link>
          </DropdownMenuItem>
        )}
        {settingsTo && (
          <DropdownMenuItem asChild className="gap-2">
            <Link to={settingsTo}>
              <Settings className="size-4" /> {t("dashboardShell.settings")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-destructive">
          <LogOut className="size-4" /> {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
