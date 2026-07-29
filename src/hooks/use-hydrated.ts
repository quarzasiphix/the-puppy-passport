import * as React from "react";

// True only once React has mounted client-side and finished attaching event handlers. Server-
// rendered markup always reports false on the very first client render (matching SSR output, so
// no hydration mismatch), then flips true on the next tick. Used to disable a form's submit
// button for that brief window — on a slow device or a fast click right after page load, the
// browser's native form submission (a plain GET to the current URL) can otherwise fire before
// React's onSubmit handler attaches, leaking form values (e.g. a password) into the URL query
// string. See docs/E2E_TESTING.md for the real Playwright trace that first found this.
export function useHydrated() {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
