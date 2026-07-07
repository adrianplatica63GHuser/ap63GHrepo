"use client";

/**
 * Client-only dynamic wrapper around ImportBrowser.
 *
 * ImportBrowser's first render branches on `typeof window !== "undefined" &&
 * window.showDirectoryPicker` to decide whether to show the "browser not
 * supported" message or the real file browser. That check is always false
 * during SSR (no `window` on the server) and true on the client in
 * Chrome/Edge — exactly the browsers this feature targets — so a normal
 * (SSR'd) render of ImportBrowser produces two different element trees on
 * the server vs. the first client paint, triggering a React hydration
 * error for every user on a supported browser.
 *
 * Fix: skip SSR for this component entirely via next/dynamic's
 * `ssr: false`. The slot renders nothing during the server pass and the
 * initial client paint (identical on both sides — no mismatch), then
 * ImportBrowser mounts fresh, client-only, after hydration completes, where
 * it can safely read `window` without anything to compare against.
 *
 * `ssr: false` is not allowed directly inside a Server Component (page.tsx
 * is one, since it's `async` and calls `getTranslations`), so this tiny
 * "use client" wrapper exists solely to host the dynamic() call.
 */

import dynamic from "next/dynamic";

/**
 * Slice #21.01.Import: switched from ImportBrowser → ImportWizard.
 * The old ImportBrowser is kept on disk but no longer used in the nav flow.
 */
const ImportWizard = dynamic(
  () => import("./import-wizard").then((m) => m.ImportWizard),
  { ssr: false },
);

export { ImportWizard as ImportBrowserDynamic };
