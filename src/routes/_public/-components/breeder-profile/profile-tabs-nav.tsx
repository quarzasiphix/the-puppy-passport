import type { LucideIcon } from "lucide-react";
import { TabsList, TabsTrigger } from "@/shared/ui/tabs";

export type ProfileTab = {
  value: string;
  label: string;
  icon: LucideIcon;
  /** Omit or 0 to show no count chip — never render a fabricated/zero-looking count. */
  count?: number;
};

// The plain shadcn TabsList/TabsTrigger (a muted rounded-lg strip meant for a handful of short
// labels) doesn't scale to 8 items with icons and counts — that's exactly the "flat row of 8"
// problem the redesign brief calls out. Rather than fork a parallel tab implementation, this
// restyles the same Radix-backed Tabs primitives via className: horizontally scrollable instead
// of wrapping (wrapping turns a tab bar into a second unrelated row of buttons — poor UX on a
// narrow viewport), and sticky under the site header so it stays reachable while scrolling a long
// tab (Puppies, Posts). Functionality (8 tabs, all reachable, same values) is unchanged — only
// presentation.
//
// Full-bleed when stuck: the outer sticky bar cancels the page wrapper's own side padding with a
// matching negative margin (-mx-4 sm:-mx-6 against src/routes/_public/@{$handle}.tsx's px-4
// sm:px-6 — the two must stay in sync) so its background/border span the full viewport width like
// a native app tab bar, not just the width of the page content column. The bar itself has no
// card/border of its own any more (that's what made it read as inset from the edges before); only
// the active pill carries a background, in the kennel's own brand color (bg-accent/
// text-accent-foreground — see getAccentCssVars in the parent route) so the personalization shows
// up in the one place a visitor interacts with most, not just the header.
export function ProfileTabsNav({ tabs }: { tabs: ProfileTab[] }) {
  return (
    <div className="sticky top-16 z-10 -mx-4 -mt-px border-b border-border/60 bg-background/95 py-3 backdrop-blur-sm sm:-mx-6">
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-none bg-transparent p-0 px-4 shadow-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-6">
        {tabs.map(({ value, label, icon: Icon, count }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="group shrink-0 snap-start gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none"
          >
            <Icon className="size-4 shrink-0" />
            {label}
            {!!count && (
              <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-foreground/70 group-data-[state=active]:bg-accent-foreground/20 group-data-[state=active]:text-accent-foreground">
                {count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}
