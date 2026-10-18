/**
 * The band of column names on the four principal lists — which names take two rows, and where they break.
 *                                                                                                  (Slice #39.83)
 *
 * Adrian, 2026-10-18: „if the name of the field selected to be a column is rather long It should be wrapped on two
 * rows", and „the bar with the column names … will have a height of three rows". The screen is
 * `@/components/table/list-head`; this is the part that needs no React.
 *
 * - **Always two rows: the names Adrian listed** (his „for example"), by the chooser key of their column, in both
 *   languages (#39.83's Ask first 1): Date of Birth, Date of death, Place of Birth, Professional type, Relationship
 *   to the business, Use Category, Property Type, Institution / Notariat, No. of Pages, No. of Persons, No. of
 *   Properties, Official (m²), Calculated (m²). Each breaks where its two rows come out most even (`splitName`).
 * - **Any other name of more than one word wraps only when its column is narrower than it** — the browser balances
 *   the two rows (`text-wrap: balance`), and a column is sized so that no name ever needs a third
 *   (`src/lib/ui/field-widths.ts`, measured; `domain-lists-one-line.test.ts` holds it).
 *
 * PURE — `list-head.test.ts` covers it.
 */

/** The chooser keys whose names always take two rows, per list (Adrian's list of 2026-10-18). */
export const TWO_ROW_NAMES = {
  property: ["surfaceAreaMp", "calculatedAreaMp", "useCategory", "propertyType"],
  person: ["dateOfBirth", "dateOfDeath", "placeOfBirth", "professionalType", "relationships"],
  company: [],
  document: ["institution", "pageCount", "personCount", "propertyCount"],
} as const satisfies Record<string, readonly string[]>;

export type ListHeadKind = keyof typeof TWO_ROW_NAMES;

export function twoRowName(list: ListHeadKind, key: string): boolean {
  return (TWO_ROW_NAMES[list] as readonly string[]).includes(key);
}

/**
 * A name's words, a lone „/" (or a dash) kept with the word before it — „Instituție /" „Notariat", never
 * „Instituție" „/ Notariat".
 */
function words(name: string): string[] {
  const out: string[] = [];
  for (const w of name.trim().split(/\s+/)) {
    if (out.length > 0 && /^[/–-]$/.test(w)) out[out.length - 1] += ` ${w}`;
    else if (w) out.push(w);
  }
  return out;
}

/**
 * `name` broken into the two rows that come out most even — the longer row as short as it can be, counted in
 * characters (the band is one font, upper case, so characters stand for width; measured in the browser pane on
 * 2026-10-18, a tie broken by keeping the longer row first, the character split is the pixel split on every name of
 * the four lists in both languages but one: „Categorie de / folosință" (94.1 px) where „Categorie / de folosință" is
 * 92.9 — 1.2 px, inside every column it is drawn in). `null` for a one-word name, which cannot break.
 */
export function splitName(name: string): [string, string] | null {
  const ws = words(name);
  if (ws.length < 2) return null;
  let best: [string, string] | null = null;
  let bestLen = Infinity;
  for (let i = 1; i < ws.length; i++) {
    const a = ws.slice(0, i).join(" ");
    const b = ws.slice(i).join(" ");
    const len = Math.max(a.length, b.length);
    if (len < bestLen || (len === bestLen && best !== null && a.length > best[0].length)) {
      best = [a, b];
      bestLen = len;
    }
  }
  return best;
}
