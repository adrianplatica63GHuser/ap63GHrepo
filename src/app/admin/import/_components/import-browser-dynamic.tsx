"use client";

/**
 * Client-only dynamic wrapper around ImportWizard.
 *
 * ImportWizard's folder picker branches on `typeof window !== "undefined" &&
 * "showDirectoryPicker" in window` to decide whether to show the "browser not
 * supported" message or the real folder picker. That check is always false
 * during SSR (no `window` on the server) and true on the client in
 * Chrome/Edge — exactly the browsers this feature targets — so a normal
 * (SSR'd) render of ImportWizard produces two different element trees on
 * the server vs. the first client paint, triggering a React hydration
 * error for every user on a supported browser.
 *
 * Fix: skip SSR for this component entirely via next/dynamic's
 * `ssr: false`. The slot renders nothing during the server pass and the
 * initial client paint (identical on both sides — no mismatch), then
 * ImportWizard mounts fresh, client-only, after hydration completes, where
 * it can safely read `window` without anything to compare against.
 *
 * `ssr: false` is not allowed directly inside a Server Component (page.tsx
 * is one, since it's `async` and calls `getTranslations`), so this tiny
 * "use client" wrapper exists solely to host the dynamic() call.
 */

import dynamic from "next/dynamic";

/**
 * Slice #21.01.Import switched this wrapper from ImportBrowser to ImportWizard
 * and left the old component on disk; Slice #23.04.Import deleted ImportBrowser
 * and everything it mounted. ImportWizard is now the only Admin -> Import
 * surface. The `ImportBrowserDynamic` export name below is kept purely so
 * page.tsx needs no change — there is no ImportBrowser behind it any more.
 */
const ImportWizard = dynamic(
  () => import("./import-wizard").then((m) => m.ImportWizard),
  { ssr: false },
);

export { ImportWizard as ImportBrowserDynamic };
