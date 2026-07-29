"use client";

/**
 * Client-only dynamic wrapper around the ORIGINAL ImportBrowser.
 *
 * This exists purely so Adrian can reach the pre-#21.01.Import flow again for
 * reference — see the page.tsx in this route for the full explanation. Do NOT
 * confuse this with src/app/admin/import/_components/import-browser-dynamic.tsx,
 * which is the live wizard's wrapper and must not be touched by this route.
 *
 * ImportBrowser's first render branches on `typeof window !== "undefined" &&
 * window.showDirectoryPicker` (baked into a useState initialiser) to decide
 * whether to show the "browser not supported" message or the real file
 * browser. That check is always false during SSR (no `window` on the server)
 * and true on the client in Chrome/Edge, so a normal (SSR'd) render produces
 * two different element trees on the server vs. the first client paint,
 * triggering a React hydration error. Fix: skip SSR for this component
 * entirely via next/dynamic's `ssr: false` — the exact same fix the live
 * wizard's wrapper documents, because ImportBrowser is where that fix
 * originated before Slice #21.01.Import swapped the live route over to
 * ImportWizard instead.
 */

import dynamic from "next/dynamic";

const ImportBrowser = dynamic(
  () => import("@/app/admin/import/_components/import-browser").then((m) => m.ImportBrowser),
  { ssr: false },
);

export { ImportBrowser as ImportBrowserLegacy };
