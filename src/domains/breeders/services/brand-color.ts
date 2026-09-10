import type { CSSProperties } from "react";

// Kennel brand color — a curated palette, not a free-form picker. `organisation_site_configurations
// .primary_color` (KennelSiteConfiguration.primaryColor) already existed in the schema/service
// layer with zero UI ever setting or rendering it — this is the first real feature built on it.
//
// Curated on purpose: a fixed set of pre-checked hex values guarantees every combination stays
// legible (white text on a solid swatch, the swatch's own hex as text on a white/card background)
// without runtime contrast math, AND keeps every possible class name a static, literal string
// Tailwind's build-time content scanner can see — the moment a color comes from a per-row runtime
// value (a hex straight out of the database) is exactly the moment `bg-[${hex}]`-style dynamic
// arbitrary values silently fail to render in production, because Tailwind never saw that string
// at build time. Every place this module (or a caller) needs to actually paint one of these colors
// uses an inline `style`, never a constructed Tailwind class name — see getAccentStyleVars below.
//
// Gated behind KennelCapabilities.canCustomizeTheme (see ../types.ts) — the same Pro+ capability
// that already gates the `theme` selector in dashboard/breeder/settings.tsx. Not a new paywall,
// just reusing the one that already exists ("perhaps a premium feature in the future" — it already
// is, today, via the existing plan system).
export type BreederBrandColorKey =
  "ocean" | "plum" | "berry" | "amber" | "sage" | "slate" | "rust" | "teal";

export const BREEDER_BRAND_PALETTE: { key: BreederBrandColorKey; hex: string; labelKey: string }[] =
  [
    { key: "ocean", hex: "#1F5C8B", labelKey: "breederPanel.brandColor.ocean" },
    { key: "plum", hex: "#6B3468", labelKey: "breederPanel.brandColor.plum" },
    { key: "berry", hex: "#9C3556", labelKey: "breederPanel.brandColor.berry" },
    { key: "amber", hex: "#9C6A1A", labelKey: "breederPanel.brandColor.amber" },
    { key: "sage", hex: "#3F6E52", labelKey: "breederPanel.brandColor.sage" },
    { key: "slate", hex: "#43566B", labelKey: "breederPanel.brandColor.slate" },
    { key: "rust", hex: "#9B4A30", labelKey: "breederPanel.brandColor.rust" },
    { key: "teal", hex: "#1F6E63", labelKey: "breederPanel.brandColor.teal" },
  ];

/** `organisation_site_configurations.primary_color` stores the raw hex directly (not a palette
 * key) — self-describing, and a saved value keeps rendering correctly even if the palette itself
 * changes later. This just validates a stored value is still one of the pickable swatches, for the
 * settings UI's "selected" state; rendering elsewhere accepts any hex string, on the assumption a
 * value that made it into this column was written by the picker below (or is null). */
export function isKnownBrandColor(hex: string | null): boolean {
  return !!hex && BREEDER_BRAND_PALETTE.some((c) => c.hex.toLowerCase() === hex.toLowerCase());
}

/** CSS custom-property overrides for a subtree that should render in a kennel's own brand color —
 * their dashboard, their public profile page. Overriding `--accent`/`--accent-foreground` (the raw
 * variables `@theme inline` maps `--color-accent`/`--color-accent-foreground` onto, see
 * src/styles.css) means every existing `bg-accent`/`text-accent`/`border-accent` utility already
 * in use throughout that subtree picks up the brand color for free — no component-by-component
 * change needed. All 8 palette colors were chosen dark/mid enough that white foreground text reads
 * fine on every one, so the foreground half never needs to vary. Not used on shared/mixed surfaces
 * (breeders list, marketplace puppy cards) where several different kennels' content sits side by
 * side — see accentAsSubtleStyle below for that case instead. */
export function getAccentCssVars(hex: string | null | undefined): CSSProperties | undefined {
  if (!hex) return undefined;
  return { "--accent": hex, "--accent-foreground": "#ffffff" } as CSSProperties;
}

/** A contained, non-cascading accent for a card that sits in a shared grid alongside other
 * kennels' cards (breeders list, puppy cards on the marketplace) — a colored left edge, deliberately
 * NOT a CSS-var override, so it can never bleed into that card's own badges/buttons (a "Verified"
 * badge, a status pill) that aren't meant to carry any one kennel's branding. */
export function accentBorderStyle(hex: string | null | undefined): CSSProperties | undefined {
  if (!hex) return undefined;
  return { borderLeftColor: hex, borderLeftWidth: 4 };
}
