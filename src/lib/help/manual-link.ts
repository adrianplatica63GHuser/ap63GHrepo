/**
 * A screen's „Vezi în manual” link, resolved on the server.                                  (Slice #39.40)
 *
 * The registry names the section by id (`helpScreenManualSection`); this turns it into what the popover
 * draws — the address and, per language, the section's CURRENT number and title. It runs in the help API, not
 * in the popover, so the manual's text (some 50 000 words in two languages) never enters the bundle every
 * screen loads just to draw one line.
 */
import { manualHref, manualTarget } from "@/lib/manual/manual";
import type { ManualLocale } from "@/lib/manual/format";
import { helpScreenManualSection } from "./registry";

export type HelpManualLink = {
  id: string;
  href: string;
  labels: Record<ManualLocale, { number: string; title: string }>;
};

/** Null when the screen names no section, or when its section is missing from either language's manual. */
export function helpManualLink(screenKey: string): HelpManualLink | null {
  const id = helpScreenManualSection(screenKey);
  if (!id) return null;
  const ro = manualTarget("ro-RO", id);
  const en = manualTarget("en-GB", id);
  if (!ro || !en) return null;
  return {
    id,
    href: manualHref(id),
    labels: {
      "ro-RO": { number: ro.number, title: ro.title },
      "en-GB": { number: en.number, title: en.title },
    },
  };
}
