import { useState, type ComponentPropsWithoutRef } from "react";
import placeholderImg from "@/assets/puppy-1.jpg";

// Every mapper in src/lib/queries/marketplace.ts already falls back to this same local placeholder
// when the database has no image at all. This component covers the other failure mode: a stored
// image URL is present and valid-looking, but the actual file 404s at render time (deleted from
// storage, a broken migration, a dead external URL) — swap to the placeholder once, instead of
// showing the browser's broken-image icon indefinitely.
export function AnimalImage({
  src,
  onError,
  ...rest
}: ComponentPropsWithoutRef<"img"> & { src: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      {...rest}
      src={failed ? placeholderImg : src}
      onError={(e) => {
        if (!failed) setFailed(true);
        onError?.(e);
      }}
    />
  );
}
