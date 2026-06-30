"use client";

// ---------------------------------------------------------------------------
// Field pulse context  (Slice #18.15.bugs / Bug 1)
// ---------------------------------------------------------------------------
//
// The versioned detail forms (Property, Natural/Judicial Person, Document) point
// out the most recent change (the diff between version N-1 and the latest N) by
// briefly PULSING the green/red diff frames on the latest version, then clearing
// them. The pulse is driven by transient state in each form; this context lets
// that one boolean reach every field component without threading a prop through
// dozens of call sites.
//
// `usePulseRing` is the hook field components call to obtain their frame
// className — it folds in the pulsing flag from context, so a field that is part
// of the current diff renders the static ring on a historical version and the
// animated pulse on the freshly-navigated-to latest. Outside any provider the
// context defaults to `false` (static rings), so existing read-only callers and
// unrelated AddressBlock consumers are unaffected.

import { createContext, useContext } from "react";
import type { HighlightColor } from "@/lib/versioning/field-diff";
import { highlightRingClass } from "@/lib/versioning/highlight-ring";

/** True while a form is pulsing the latest version's N-1 -> N change. */
export const FieldPulseContext = createContext(false);

/** Field frame className, with the pulsing flag pulled from context. */
export function usePulseRing(h: HighlightColor | undefined): string {
  return highlightRingClass(h, useContext(FieldPulseContext));
}
