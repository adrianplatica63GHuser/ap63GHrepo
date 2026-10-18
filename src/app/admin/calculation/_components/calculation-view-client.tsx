"use client";

import dynamic from "next/dynamic";

/**
 * „Calcul drum lateral" drawn in the browser only (2026-10-18). The screen opens on what this browser kept of the
 * last visit, or on a re-run's payload — both read from the browser's storage while the first render is computed. A
 * server render could not see either, and its empty screen would not match the browser's; so there is none.
 */
export const CalculationViewClient = dynamic(() => import("./calculation-view").then((m) => m.CalculationView), { ssr: false });
