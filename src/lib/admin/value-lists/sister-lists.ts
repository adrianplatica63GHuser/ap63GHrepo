/**
 * Two value lists kept in step by hand: „Cetățenie" and „Țara adresei".                              (Slice 41.51)
 *
 * Adrian, 2026-11-02: „Whenever someone tries to modify the values in either of these two value lists under Reference
 * data: please provide a notification message (at save time) about the possible need to update the sister value list
 * to keep In Sync with the saved change". The two hold the same countries in two forms — „Română" and „România" —
 * so nothing can copy a change across; the notice says it, after an add, an edit, a delete or a merge that succeeded.
 *
 * Pure: the screen asks `sisterOf` and writes the sentence itself (value-list-modal.tsx).
 */
import type { ListKey } from "./config";

const SISTERS: Partial<Record<ListKey, ListKey>> = {
  citizenships: "address-countries",
  "address-countries": "citizenships",
};

/** The list a change to `list` may need repeating in, or null. */
export function sisterOf(list: ListKey): ListKey | null {
  return SISTERS[list] ?? null;
}
