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
} from "lucide-react";
import type { DashboardNavItem } from "@/app/layouts/dashboard-shell";

// Centralised dashboard navigation. One array per workspace so a new destination is a single
// entry here, not an edit in a route module. Route URLs are frozen during the frontend
// restructure — see docs/FRONTEND_ARCHITECTURE.md.

export const buyerNav: DashboardNavItem[] = [
  { to: "/dashboard/buyer", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/buyer/transport", label: "Transport requests", icon: Truck },
  { to: "/dashboard/buyer/quotations", label: "Quotations", icon: Receipt },
  { to: "/dashboard/buyer/scheduled", label: "Scheduled transports", icon: CalendarCheck },
  { to: "/dashboard/buyer/documents", label: "Documents", icon: FileText },
  { to: "/dashboard/buyer/saved", label: "Saved dogs", icon: Heart },
  { to: "/dashboard/buyer/applications", label: "Puppy applications", icon: Inbox },
  { to: "/dashboard/buyer/messages", label: "Messages", icon: MessageSquare },
  { to: "/dashboard/buyer/followed", label: "Followed profiles", icon: PawPrint },
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
    to: "/dashboard/breeder/transport",
    label: "breederPanel.nav.transport",
    icon: Truck,
    section: "breederPanel.nav.sectionSales",
  },
  {
    to: "/dashboard/breeder/profile",
    label: "breederPanel.nav.publicProfile",
    icon: User,
    section: "breederPanel.nav.sectionMyKennel",
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

export const operationsNav: DashboardNavItem[] = [
  { to: "/dashboard/operations", label: "Operations overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/operations/new-requests", label: "New requests", icon: Inbox },
  { to: "/dashboard/operations/review-queue", label: "Review queue", icon: ClipboardCheck },
  { to: "/dashboard/operations/quotations", label: "Quotations", icon: Receipt },
  { to: "/dashboard/operations/routes", label: "Planned routes", icon: RouteIcon },
  { to: "/dashboard/operations/profitability", label: "Profitability", icon: TrendingUp },
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

export const adminNav: DashboardNavItem[] = [
  { to: "/dashboard/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/admin/users", label: "Users", icon: Users },
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
  { to: "/dashboard/admin/fundraising", label: "Fundraising", icon: Coins },
  { to: "/dashboard/operations", label: "Transport operations", icon: Truck },
  { to: "/dashboard/admin/audit-logs", label: "Audit logs", icon: ScrollText },
  { to: "/dashboard/admin/settings", label: "Settings", icon: Settings },
];
