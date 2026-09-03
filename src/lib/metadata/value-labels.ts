/**
 * The Romanian words for a curation value, wherever a LIST prints one.
 *                                                                (Slice #32.19)
 *
 * WHY THIS EXISTS
 * ---------------
 * Slice #23.10.dev hid the Importance / Relevance / Provenance columns behind
 * the developer-tools flag, and while they were hidden their cells printed the
 * raw database code: `HIGH`, `AI_INTERPRETED`, `COORDINATE_FILE`. That was
 * survivable for a developer reading his own diagnostics. Slice #32.19 reveals
 * the columns at Adrian's request, and an adversarial round named what that
 * ships: a Romanian user opens the Importance dropdown beside the column, which
 * reads „Ridicată", picks it, and the column immediately below reads `HIGH`.
 * The filter and the cell it filters would have disagreed about the same value,
 * in the same row, on three record lists and Global Search.
 *
 * ⚠️ **NO NEW COPY, AND THAT IS THE POINT.** Every label already exists and is
 * already the one the user sees somewhere else:
 *
 *   - importance / relevance → `shared.importanceValues.*` and
 *     `shared.relevanceValues.*`, which are exactly what the filter dropdowns
 *     beside these columns render.
 *   - provenance → `shared.entityMetadata.provenance.<camelCase>`, the labels
 *     the Metadata tab's own picker draws, keyed through `provenanceI18nKey` so
 *     this file holds no second spelling of the mapping.
 *
 * A fourth copy of the value list is what `provenance.ts`'s header exists to
 * prevent; this module adds none.
 *
 * ⚠️ **`t` IS TAKEN LOOSELY ON PURPOSE.** next-intl types its key argument as a
 * literal union per namespace, and every call site in this codebase that builds
 * a key from a value already casts (`as Parameters<typeof t>[0]`). Taking a
 * plain `(key: string) => string` here means the cast happens once, at the four
 * call sites' hooks, instead of once per case in four `cellValue` switches.
 *
 * Client-safe: no DB, no React, no next/*.
 */

import { isProvenanceCode, provenanceI18nKey } from "@/lib/metadata/provenance";

/** A `useTranslations("shared")` bound to the namespace these keys live under. */
export type SharedTranslator = (key: string) => string;

/**
 * The label for one stored value, or `""` when there is nothing stored.
 *
 * ⚠️ **An UNKNOWN code comes back as itself, not as a thrown key error.** A row
 * written by a migration this build does not know about must still render its
 * cell — a list that throws on one unrecognised value is worse than one that
 * shows the code for it, and next-intl would otherwise render the raw key path.
 */
export function metadataValueLabel(
  t: SharedTranslator,
  field: "importance" | "relevance" | "provenance",
  value: string | null | undefined,
): string {
  const code = (value ?? "").trim();
  if (!code) return "";
  if (field === "provenance") {
    if (!isProvenanceCode(code)) return code;
    return t(`entityMetadata.provenance.${provenanceI18nKey(code)}`);
  }
  const known =
    field === "importance"
      ? ["LOW", "MEDIUM", "HIGH"]
      : ["INACTIVE", "HISTORICAL", "CURRENT", "FUTURE"];
  if (!known.includes(code)) return code;
  return t(`${field === "importance" ? "importanceValues" : "relevanceValues"}.${code}`);
}
