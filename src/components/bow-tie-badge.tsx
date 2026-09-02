"use client";

import { useTranslations } from "next-intl";

/**
 * Slice #32.14 — a small badge rendered next to a property row's checkbox when
 * the stored corner ORDER traces a self-intersecting ring.
 *
 * Deliberately shaped after `RecencyBadge` next to it: same slot, same size,
 * same "a word in colour, or nothing at all" idiom. It is NOT an optional
 * column, and that is the point of the slice — PROP01444's area was wrong by
 * four orders of magnitude for as long as it took someone to open the property
 * and notice, so the mark has to be visible from the list without opening
 * anything, and without the user having first chosen to show a column.
 *
 * Amber rather than red: nothing is broken and no data is at risk. The corners
 * are exactly as they were entered; it is their ORDER that makes the calculated
 * area beside them meaningless, and the fix is one press on the property form.
 */
export function BowTieBadge({ selfIntersects }: { selfIntersects: boolean }) {
  const t = useTranslations("shared.bowTie");

  if (!selfIntersects) return null;

  return (
    <span
      className="ml-1.5 font-semibold whitespace-nowrap text-amber-600 dark:text-amber-500"
      style={{ fontSize: "0.75em" }}
      title={t("title")}
    >
      {t("label")}
    </span>
  );
}
