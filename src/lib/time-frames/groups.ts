/**
 * „Praguri de timp", grouped by where each threshold acts.        (Slice #38.40)
 *
 * Ten thresholds in one column said nothing about where any of them shows. The
 * four groups are the four places: the dashboard, the documents, the persons,
 * and the „Nou!" badge. Every key is in exactly one group — the test holds it —
 * so a key added to TIME_FRAME_KEYS without a group fails rather than vanishes.
 *
 * The worked example under each threshold is a message per key
 * (`settings.timeFrames.examples.<key>`), given `{duration}`: the value being
 * edited, in words, so the sentence changes as the box does.
 */

import { TIME_FRAME_KEYS, type TimeFrameKey } from "./config";

export const TIME_FRAME_GROUPS = [
  {
    id: "dashboard",
    keys: ["dashboard_recent_days", "dashboard_expiring_docs", "dashboard_expiring_amber", "dashboard_stale_metadata"],
  },
  { id: "documents", keys: ["documents_expiring_soon", "metadata_review_warning"] },
  { id: "persons", keys: ["id_card_expiring_soon"] },
  { id: "recency", keys: ["recency_badge_red", "recency_badge_amber", "recency_badge_window"] },
] as const satisfies readonly { id: string; keys: readonly TimeFrameKey[] }[];

export type TimeFrameGroupId = (typeof TIME_FRAME_GROUPS)[number]["id"];

/** The keys no group holds, and the ones two groups hold — both empty, or the screen lies. */
export function groupingProblems(): { missing: TimeFrameKey[]; twice: TimeFrameKey[] } {
  const seen = TIME_FRAME_GROUPS.flatMap((g) => [...g.keys] as TimeFrameKey[]);
  return {
    missing: TIME_FRAME_KEYS.filter((k) => !seen.includes(k)),
    twice: TIME_FRAME_KEYS.filter((k) => seen.filter((s) => s === k).length > 1),
  };
}

/**
 * The number the example speaks of: the draft while it is a whole number in
 * range, the saved value otherwise — an example of „abc zile" helps nobody.
 */
export function exampleValue(draft: string | undefined, saved: number, parse: (raw: string) => number | null): number {
  if (draft === undefined) return saved;
  return parse(draft) ?? saved;
}
