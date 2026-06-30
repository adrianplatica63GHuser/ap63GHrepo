/**
 * Versioning — highlight-frame className helper  (Slice #18.15.bugs / Bug 1)
 *
 * Pure (no React) so it unit-tests directly and can be imported from both the
 * client `field-pulse` context module and anywhere a frame className is needed.
 *
 * Two visual modes for the same green/red version-diff frame:
 *   - static ring  — shown on a read-only HISTORICAL version (existing behaviour,
 *                    Slice #18.02/#18.05/#18.06); a steady 2px coloured ring.
 *   - animated pulse — shown briefly on the LATEST version right after the user
 *                    navigates onto it from a different version, to point out the
 *                    N-1 -> N change (the new Bug 1 behaviour). The `.ga-vpulse-*`
 *                    classes (defined in globals.css) pulse a coloured box-shadow
 *                    ~3 times over ~2.5s and then leave no ring.
 */

import type { HighlightColor } from "@/lib/versioning/field-diff";

/**
 * className for a field's version-diff frame.
 *  - `h` undefined         -> "" (field did not change; no frame)
 *  - `pulsing` false        -> static ring (historical-version view)
 *  - `pulsing` true         -> animated pulse (latest-version N-1 -> N hint)
 */
export function highlightRingClass(
  h: HighlightColor | undefined,
  pulsing: boolean,
): string {
  if (!h) return "";
  if (pulsing) return h === "green" ? "ga-vpulse-green" : "ga-vpulse-red";
  return h === "green" ? "ring-2 ring-green-500" : "ring-2 ring-red-500";
}
