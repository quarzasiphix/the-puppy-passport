import {
  LayoutDashboard,
  User,
  Users,
  Building2,
  Dog,
  Baby,
  PawPrint,
  Inbox,
  CalendarCheck,
  Truck,
  Award,
  Crown,
  FileText,
  MessageSquare,
  Settings,
  HeartHandshake,
  Heart,
  Receipt,
  AlertTriangle,
  ClipboardCheck,
  Route as RouteIcon,
  Sparkles,
  Calendar,
  Car,
  UserRound,
  ShieldAlert,
  AlertOctagon,
  CheckCircle2,
  TrendingUp,
  HeartPulse,
  Flag,
  Coins,
  ScrollText,
  Network,
  ShieldCheck,
  Shuffle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DashboardNavItem } from "@/app/layouts/dashboard-shell";

// Every role that has a dashboard, in switcher order — consumed by both the sidebar's
// WorkspaceSwitcher and UserMenu's mobile workspace-switch section (dashboard-shell.tsx /
// user-menu.tsx). Lives here rather than in dashboard-shell.tsx itself so user-menu.tsx can import
// it without a circular dependency (dashboard-shell.tsx doesn't import from user-menu.tsx, but
// would need to once it renders UserMenu directly — see the mobile-header consolidation below).
// `id` keys the three translated-phrase maps (dashboardShell.workspaces/panelLabel/switchTo in the
// locale files) — kept separate from composing a sentence out of parts because Polish word order
// for "Breeder panel" ("Panel hodowcy") isn't just the English order with a translated noun swapped
// in.
export const dashboardWorkspaces: { to: string; id: string; roles: string[]; icon: LucideIcon }[] =
  [
    { to: "/dashboard/buyer", id: "customer", roles: [], icon: User }, // every signed-in user has this one
    { to: "/dashboard/breeder", id: "breeder", roles: ["breeder"], icon: Dog },
    {
      to: "/dashboard/foundation",
      id: "foundation",
      roles: ["foundation_member", "shelter_member"],
      icon: HeartHandshake,
    },
    {
      to: "/dashboard/transport-company",
      id: "transportCompany",
      roles: ["transport_company_owner"],
      icon: Truck,
    },
    { to: "/dashboard/operations", id: "operations", roles: ["operations", "admin"], icon: Truck },
    { to: "/dashboard/driver", id: "driver", roles: ["driver"], icon: Car },
    // Moderator and admin share one dashboard (routes/dashboard/admin.tsx) — a moderator sees the
    // same "Admin" workspace entry, just fewer items once inside (adminNavFor in navigation.ts).
    { to: "/dashboard/admin", id: "admin", roles: ["moderator", "admin"], icon: ShieldCheck },
  ];

// Centralised dashboard navigation. One array per workspace so a new destination is a single
// entry here, not an edit in a route module. Route URLs are frozen during the frontend
// restructure — see docs/FRONTEND_ARCHITECTURE.md.

export const buyerNav: DashboardNavItem[] = [
  { to: "/dashboard/buyer", label: "Overview", icon: LayoutDashboard, exact: true },
  // A real route/page (dashboard/buyer/reservations.tsx, BuyerReservationsPage) that was never
  // actually listed here — reachable only by a direct link from elsewhere, not from this sidebar
  // at all. Found while adding the mobile bottom nav (2026-09-13), which needed a real path for
  // "Reservations" as one of a buyer's primary destinations.
  { to: "/dashboard/buyer/reservations", label: "Reservations", icon: CalendarCheck },
  { to: "/dashboard/buyer/transport", label: "Transport requests", icon: Truck },
  { to: "/dashboard/buyer/quotations", label: "Quotations", icon: Receipt },
  { to: "/dashboard/buyer/scheduled", label: "Scheduled transports", icon: CalendarCheck },
  { to: "/dashboard/buyer/documents", label: "Documents", icon: FileText },
  { to: "/dashboard/buyer/saved", label: "Saved dogs", icon: Heart },
  { to: "/dashboard/buyer/applications", label: "Puppy applications", icon: Inbox },
  { to: "/dashboard/buyer/messages", label: "Messages", icon: MessageSquare },
  { to: "/dashboard/buyer/followed", label: "Followed profiles", icon: PawPrint },
  { to: "/create-breeder", label: "Register a kennel / organisation", icon: HeartHandshake },
  { to: "/dashboard/buyer/profile", label: "Account", icon: User },
];

// Grouped into named sections (breeder-panel redesign, 2026-09-10) — the old flat 14-item list
// gave every destination equal weight, which is exactly what made it hard to scan. Grouped to
// mirror how a kennel owner actually thinks about their work: dogs & litters first, then sales,
// then the public-facing kennel identity, then account admin. Modeled on the section split in the
// Gryfin York kennel's own panel (/p/grif/c/src/routes/panel.tsx — 5 primary + a "more" group).
// `label`/`section` here are i18n keys (breederPanel.nav.*), not literal text — DashboardShell
// runs every nav item through t(), so this is the one nav array in navigation.ts that actually
// renders translated (the others still pass literal English strings, which t() safely returns
// unchanged when no matching key exists — see the comment on DashboardNavItem).
export const breederNav: DashboardNavItem[] = [
  {
    to: "/dashboard/breeder",
    label: "breederPanel.nav.overview",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    to: "/dashboard/breeder/litters",
    label: "breederPanel.nav.litters",
    icon: Baby,
    section: "breederPanel.nav.sectionDogsLitters",
  },
  {
    to: "/dashboard/breeder/puppies",
    label: "breederPanel.nav.puppies",
    icon: PawPrint,
    section: "breederPanel.nav.sectionDogsLitters",
  },
  {
    to: "/dashboard/breeder/parent-dogs",
    label: "breederPanel.nav.parentDogs",
    icon: Dog,
    section: "breederPanel.nav.sectionDogsLitters",
  },
  {
    to: "/dashboard/breeder/pedigrees",
    label: "breederPanel.nav.pedigrees",
    icon: Network,
    section: "breederPanel.nav.sectionDogsLitters",
  },
  {
    to: "/dashboard/breeder/applications",
    label: "breederPanel.nav.buyerApplications",
    icon: Inbox,
    section: "breederPanel.nav.sectionSales",
  },
  {
    to: "/dashboard/breeder/reservations",
    label: "breederPanel.nav.reservations",
    icon: CalendarCheck,
    section: "breederPanel.nav.sectionSales",
  },
  {
    to: "/dashboard/breeder/payouts",
    label: "breederPanel.nav.payouts",
    icon: Coins,
    section: "breederPanel.nav.sectionSales",
  },
  {
    to: "/dashboard/breeder/transport",
    label: "breederPanel.nav.transport",
    icon: Truck,
    section: "breederPanel.nav.sectionSales",
  },
  {
    to: "/dashboard/breeder/achievements",
    label: "breederPanel.nav.achievements",
    icon: Award,
    section: "breederPanel.nav.sectionMyKennel",
  },
  {
    to: "/dashboard/breeder/champions",
    label: "breederPanel.nav.championDogs",
    icon: Crown,
    section: "breederPanel.nav.sectionMyKennel",
  },
  {
    to: "/dashboard/breeder/documents",
    label: "breederPanel.nav.documents",
    icon: FileText,
    section: "breederPanel.nav.sectionAccount",
  },
  {
    to: "/dashboard/breeder/messages",
    label: "breederPanel.nav.messages",
    icon: MessageSquare,
    section: "breederPanel.nav.sectionAccount",
  },
  {
    to: "/dashboard/breeder/settings",
    label: "breederPanel.nav.settings",
    icon: Settings,
    section: "breederPanel.nav.sectionAccount",
  },
];

export const foundationNav: DashboardNavItem[] = [
  { to: "/dashboard/foundation", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/foundation/profile", label: "Organisation profile", icon: Building2 },
  { to: "/dashboard/foundation/animals", label: "Animals", icon: PawPrint },
  { to: "/dashboard/foundation/applications", label: "Adoption applications", icon: Inbox },
  { to: "/dashboard/foundation/transport", label: "Transport requests", icon: Truck },
  { to: "/dashboard/foundation/fundraising", label: "Fundraising", icon: HeartHandshake },
  { to: "/dashboard/foundation/urgent", label: "Urgent cases", icon: AlertTriangle },
  { to: "/dashboard/foundation/documents", label: "Documents", icon: FileText },
  { to: "/dashboard/foundation/team", label: "Team", icon: Users },
  { to: "/dashboard/foundation/messages", label: "Messages", icon: MessageSquare },
  { to: "/dashboard/foundation/settings", label: "Settings", icon: Settings },
];

export const transportCompanyNav: DashboardNavItem[] = [
  {
    to: "/dashboard/transport-company",
    label: "transportCompanyPanel.nav.overview",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    to: "/dashboard/transport-company/vehicles",
    label: "transportCompanyPanel.nav.vehicles",
    icon: Car,
  },
  {
    to: "/dashboard/transport-company/drivers",
    label: "transportCompanyPanel.nav.drivers",
    icon: UserRound,
  },
  { to: "/dashboard/transport-company/jobs", label: "transportCompanyPanel.nav.jobs", icon: Truck },
  {
    to: "/dashboard/transport-company/trips",
    label: "transportCompanyPanel.nav.trips",
    icon: RouteIcon,
  },
  {
    to: "/dashboard/transport-company/dispatch",
    label: "transportCompanyPanel.nav.dispatch",
    icon: Shuffle,
  },
  {
    to: "/dashboard/transport-company/calendar",
    label: "transportCompanyPanel.nav.calendar",
    icon: Calendar,
  },
  { to: "/dashboard/transport-company/team", label: "transportCompanyPanel.nav.team", icon: Users },
  {
    to: "/dashboard/transport-company/profile",
    label: "transportCompanyPanel.nav.publicProfile",
    icon: Building2,
  },
  {
    to: "/dashboard/transport-company/settings",
    label: "transportCompanyPanel.nav.settings",
    icon: Settings,
  },
];

export const operationsNav: DashboardNavItem[] = [
  { to: "/dashboard/operations", label: "Operations overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/operations/new-requests", label: "New requests", icon: Inbox },
  { to: "/dashboard/operations/review-queue", label: "Review queue", icon: ClipboardCheck },
  { to: "/dashboard/operations/quotations", label: "Quotations", icon: Receipt },
  { to: "/dashboard/operations/routes", label: "Planned routes", icon: RouteIcon },
  { to: "/dashboard/operations/profitability", label: "Profitability", icon: TrendingUp },
  { to: "/dashboard/operations/payouts", label: "Payouts", icon: Coins },
  { to: "/dashboard/operations/active", label: "Active transports", icon: Truck },
  { to: "/dashboard/operations/matching", label: "Matching suggestions", icon: Sparkles },
  { to: "/dashboard/operations/dispatch", label: "Dispatch", icon: Users },
  { to: "/dashboard/operations/calendar", label: "Calendar", icon: Calendar },
  { to: "/dashboard/operations/vehicles", label: "Vehicles", icon: Car },
  { to: "/dashboard/operations/drivers", label: "Drivers", icon: UserRound },
  { to: "/dashboard/operations/documents", label: "Documents", icon: FileText },
  { to: "/dashboard/operations/compliance-holds", label: "Compliance holds", icon: ShieldAlert },
  { to: "/dashboard/operations/welfare-cases", label: "Welfare cases", icon: HeartPulse },
  { to: "/dashboard/operations/incidents", label: "Incidents", icon: AlertOctagon },
  { to: "/dashboard/operations/completed", label: "Completed transports", icon: CheckCircle2 },
];

// Deliberately a single item — this workspace is opened on a phone during a job, not browsed.
export const driverNav: DashboardNavItem[] = [
  { to: "/dashboard/driver", label: "My route", icon: Truck, exact: true },
];

// One shared dashboard for moderator + admin (see routes/dashboard/admin.tsx) — a moderator gets
// the items every moderator action in this session's build needs (verification, organisations,
// listings, reports/moderation); the admin-only items are genuinely sensitive pages that each also
// carry their own `requireRole(["admin"])`, so hiding them here is a UX nicety, not the real gate.
const adminOnlyNavItems: DashboardNavItem[] = [
  { to: "/dashboard/admin/users", label: "Users", icon: Users },
  { to: "/dashboard/admin/fundraising", label: "Fundraising", icon: Coins },
  { to: "/dashboard/operations", label: "Transport operations", icon: Truck },
  { to: "/dashboard/admin/audit-logs", label: "Audit logs", icon: ScrollText },
  { to: "/dashboard/admin/settings", label: "Settings", icon: Settings },
];

const sharedAdminNavItems: DashboardNavItem[] = [
  { to: "/dashboard/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/admin/organisations", label: "Organisations", icon: Building2 },
  { to: "/dashboard/admin/breeder-verification", label: "Breeder verification", icon: Dog },
  {
    to: "/dashboard/admin/foundation-verification",
    label: "Foundation verification",
    icon: HeartHandshake,
  },
  { to: "/dashboard/admin/listings", label: "Listings", icon: PawPrint },
  {
    to: "/dashboard/admin/achievement-verification",
    label: "Achievement verification",
    icon: Award,
  },
  { to: "/dashboard/admin/reports", label: "Reports", icon: Flag },
  { to: "/dashboard/admin/moderation", label: "Moderation", icon: ShieldAlert },
];

export function adminNavFor(isAdmin: boolean): DashboardNavItem[] {
  return isAdmin ? [...sharedAdminNavItems, ...adminOnlyNavItems] : sharedAdminNavItems;
}

// Mobile bottom navigation bars, one per dashboard — the same pattern as the public site's own
// bottom bar (site-chrome.tsx's `bottomNav`): a handful of real, already-existing pages (never a
// destination invented just for this bar), rendered as a fixed row at the very bottom of the
// screen below `lg`, where the full sidebar is hidden. Each array is deliberately a curated
// subset, not `navItems.slice(0, n)` — a dashboard's full sidebar order isn't necessarily its most
// important 3-4 destinations on a phone (e.g. buyerNav lists Overview first for the sidebar, but
// Reservations/Messages matter more for a five-button mobile bar). DashboardShell always appends
// one more "More" button after these that opens the exact same nav Sheet the hamburger does, so
// nothing on the full sidebar becomes unreachable on mobile — this bar is a shortcut, not a
// replacement. Kept to 3-4 entries each (site-chrome's own comment: a bar past ~5 columns stops
// being legible at the 400px-wide floor this app supports; the trailing "More" button is the +1).
// Bottom-nav labels are i18n keys, not literal text (fixed 2026-09-13 — these previously passed
// plain English strings straight through, which t() silently returns unchanged for any locale
// since there's no matching key, so the bar never actually translated regardless of the selected
// language). Reuses the matching sidebar key where one already exists (breederNav,
// transportCompanyNav are already i18n'd); the rest point at new, matching `nav` keys added to
// each panel's own locale namespace.
export const buyerBottomNav: DashboardNavItem[] = [
  { to: "/dashboard/buyer", label: "buyerPanel.nav.overview", icon: LayoutDashboard, exact: true },
  {
    to: "/dashboard/buyer/reservations",
    label: "buyerPanel.nav.reservations",
    icon: CalendarCheck,
  },
  { to: "/dashboard/buyer/messages", label: "buyerPanel.nav.messages", icon: MessageSquare },
  { to: "/dashboard/buyer/profile", label: "buyerPanel.nav.account", icon: User },
];

export const breederBottomNav: DashboardNavItem[] = [
  {
    to: "/dashboard/breeder",
    label: "breederPanel.nav.overview",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    to: "/dashboard/breeder/applications",
    label: "breederPanel.nav.buyerApplications",
    icon: Inbox,
  },
  {
    to: "/dashboard/breeder/reservations",
    label: "breederPanel.nav.reservations",
    icon: CalendarCheck,
  },
  { to: "/dashboard/breeder/messages", label: "breederPanel.nav.messages", icon: MessageSquare },
];

export const foundationBottomNav: DashboardNavItem[] = [
  {
    to: "/dashboard/foundation",
    label: "foundationPanel.nav.overview",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    to: "/dashboard/foundation/applications",
    label: "foundationPanel.nav.applications",
    icon: Inbox,
  },
  { to: "/dashboard/foundation/transport", label: "foundationPanel.nav.transport", icon: Truck },
  {
    to: "/dashboard/foundation/messages",
    label: "foundationPanel.nav.messages",
    icon: MessageSquare,
  },
];

// Updated 2026-09-14: Calendar and Dispatch are now real, company-scoped pages too (an agenda view
// over the fleet's own jobs, and a real "assign my own driver/vehicle to this job" flow backed by
// assign_own_driver_to_job()/assign_own_vehicle_to_job() — see fleet.ts) — this bar now matches
// what was originally asked for ("requests, calendar, dispatch") on the company's own dashboard,
// not just on the internal operations one below. Vehicles/Team stay one tap away via "More".
export const transportCompanyBottomNav: DashboardNavItem[] = [
  {
    to: "/dashboard/transport-company",
    label: "transportCompanyPanel.nav.overview",
    icon: LayoutDashboard,
    exact: true,
  },
  { to: "/dashboard/transport-company/jobs", label: "transportCompanyPanel.nav.jobs", icon: Truck },
  {
    to: "/dashboard/transport-company/dispatch",
    label: "transportCompanyPanel.nav.dispatch",
    icon: Shuffle,
  },
  {
    to: "/dashboard/transport-company/calendar",
    label: "transportCompanyPanel.nav.calendar",
    icon: Calendar,
  },
];

// The one dashboard where "requests, calendar, dispatch" are already real, existing pages today —
// this is Anemalo's own internal transport-operations dashboard (ops staff), not a breeder/
// transport-company's self-service panel. If "the transport dashboard" meant this one, it's
// already fully covered; if it meant a company's own panel, see transportCompanyBottomNav above.
export const operationsBottomNav: DashboardNavItem[] = [
  {
    to: "/dashboard/operations",
    label: "operationsPanel.nav.overview",
    icon: LayoutDashboard,
    exact: true,
  },
  { to: "/dashboard/operations/new-requests", label: "operationsPanel.nav.requests", icon: Inbox },
  { to: "/dashboard/operations/dispatch", label: "operationsPanel.nav.dispatch", icon: Users },
  { to: "/dashboard/operations/calendar", label: "operationsPanel.nav.calendar", icon: Calendar },
];

export const adminBottomNav: DashboardNavItem[] = [
  { to: "/dashboard/admin", label: "adminPanel.nav.overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/admin/reports", label: "adminPanel.nav.reports", icon: Flag },
  { to: "/dashboard/admin/moderation", label: "adminPanel.nav.moderation", icon: ShieldAlert },
  {
    to: "/dashboard/admin/organisations",
    label: "adminPanel.nav.organisations",
    icon: Building2,
  },
];

// driverNav has exactly one real page today ("My route") — a bottom bar with one destination plus
// a redundant "More" button isn't a real shortcut, so the driver dashboard intentionally has no
// bottomNavItems at all (DashboardShell just doesn't render the bar when it's omitted).
