/**
 * ID-card recognition for the import wizard — Slice #23.01.Import
 *
 * Decides whether a scanned entry is a Romanian identity card, so the import
 * results table can offer "Creează persoană din CI" on that row.
 *
 * Two signals, in priority order:
 *
 *  1. `typeKey` — Haiku's own `suggestedTypeKey`, already whitelisted against
 *     KNOWN_TYPE_KEYS by the scan route. This is the reliable signal and it
 *     was previously ignored entirely.
 *  2. `description` — the free-text `classifiedLabel`, used only when the
 *     model gave no usable key. Matched on a diacritic-folded, case-folded
 *     form, because the label comes back in whatever casing and spelling the
 *     model chose ("Carte de Identitate", "carte de identitate", "CARTE DE
 *     IDENTITATE", with or without ș/ț/ă).
 *
 * The label path carries a deliberate veto list: "carte de identitate a
 * vehiculului" (CIV) is a real Romanian document and a plain substring match
 * on "carte de identitate" classifies it as a person's ID card, which would
 * send a vehicle registration to the ID-card extractor.
 *
 * Pure module — no React, no fetch, no DB. Unit-tested in
 * src/__tests__/id-card.test.ts.
 */

/**
 * Document-type keys that mean "this is a personal identity card".
 *
 * CARTE_IDENTITATE is the only one the model can still suggest —
 * Slice #23.01.Import removed CARTE_IDENTITATE_ALT from KNOWN_TYPE_KEYS
 * because no migration ever seeded it. It is kept here deliberately as a
 * defensive match: a hand-created type row, or a saved import session from
 * before that change, can still carry the key, and treating it as anything
 * other than an ID card would be wrong.
 */
export const ID_CARD_TYPE_KEYS = ["CARTE_IDENTITATE", "CARTE_IDENTITATE_ALT"] as const;

/**
 * Lowercase and strip Romanian diacritics.
 *
 * NFD decomposition handles both encodings of ș/ț that appear in practice —
 * comma-below (U+0219/U+021B, correct Romanian) and cedilla (U+015F/U+0163,
 * the legacy Turkish-borrowed forms still emitted by some OCR and fonts) —
 * because both decompose to a base letter plus a combining mark.
 */
export function foldRomanian(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Labels that describe a different document but contain an ID-card phrase.
 * Checked before the positive patterns, so a veto always wins.
 */
const VETO_PATTERNS: RegExp[] = [
  // "carte de identitate a vehiculului" / "... auto" — vehicle registration.
  /vehicul/,
  /\bauto(mobil|turism)?\b/,
  /\bremorc/,
];

const POSITIVE_PATTERNS: RegExp[] = [
  /carte\s+(de\s+)?identitate/,
  /\bbuletin\b/,
  /act\s+de\s+identitate/,
  /\bid\s*card\b/,
  /\bidentity\s+card\b/,
  // Standalone "CI" / "C.I." — bounded so it never fires inside CIF, CIV,
  // "cinci", etc.
  /(^|[^a-z0-9])c\.?\s?i\.?([^a-z0-9]|$)/,
];

/**
 * Does this free-text classification label describe an identity card?
 * Exported separately so the label heuristic can be tested on its own.
 */
export function isIdCardLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  const folded = foldRomanian(label);
  if (!folded) return false;
  if (VETO_PATTERNS.some((re) => re.test(folded))) return false;
  return POSITIVE_PATTERNS.some((re) => re.test(folded));
}

/** The shape this module needs off a ScanResult. Structural, not imported. */
export type IdCardScanSignal = {
  typeKey?: string | null;
  description?: string | null;
};

/**
 * Is this scanned entry an ID card?
 *
 * A confident non-ID `typeKey` VETOES the label: if the model already decided
 * the document is a Contract de Vânzare, a stray "buletin" in its prose label
 * must not override that. Only a missing key, or the explicitly-uncertain
 * UNCLASSIFIED, falls through to the label heuristic.
 */
export function isIdCardEntry(scan: IdCardScanSignal | null | undefined): boolean {
  if (!scan) return false;

  const key = scan.typeKey?.trim();
  if (key) {
    if ((ID_CARD_TYPE_KEYS as readonly string[]).includes(key)) return true;
    if (key !== "UNCLASSIFIED") return false;
  }

  return isIdCardLabel(scan.description);
}
