import { cn } from "@/shared/lib/utils";

// The real Anemalo brand mark, hosted on the media CDN (not bundled — a marketing asset the brand
// owns and may update independently of a deploy). Replaces the earlier PawPrint-in-a-colored-box
// placeholder everywhere the app shows its logo: site header/footer, dashboard sidebar, auth
// pages. One component so a future logo update (URL, alt text) is a single-file change.
const LOGO_URL = "https://media.anemalo.com/logo.png";

export function Logo({ className }: { className?: string }) {
  return <img src={LOGO_URL} alt="Anemalo" className={cn("object-contain", className)} />;
}
