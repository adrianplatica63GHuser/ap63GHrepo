"use client";

import { useSyncExternalStore } from "react";
import { CalculationView } from "./calculation-view";

const subscribe = () => () => {};

/**
 * „Calcul drum lateral" drawn in the browser only (2026-10-18). The screen opens on what this browser kept of the
 * last visit, or on a re-run's payload — both read from the browser's storage while the first render is computed. A
 * server render could see neither, and its empty screen would not match the browser's; so the server draws nothing
 * and the browser draws the screen once hydrated.
 *
 * ⚠️ Not `next/dynamic` with `ssr: false`: the lazy chunk's Suspense boundary mounted the view twice in development,
 * and the first mount had already consumed the re-run's payload (TC-CALC-02 step 13 opened on the kept screen).
 */
export function CalculationViewClient() {
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  return inBrowser ? <CalculationView /> : null;
}
