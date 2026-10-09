/**
 * Fields read together in ONE cell, on one line.                 (Slice #38.55)
 *
 * A role's three converse names (#37.28) share one column of „Roluri
 * Persoană". #37.28 stacked them, one under another, which made those rows
 * three lines tall; Adrian: „Vânzător, Vânzător, Vânzătoare", not three lines.
 * The cell joins the values that are not blank, in the fields' order, with
 * „, " — and a role with none shows „–", the dash every other empty cell
 * prints (#29.13). One line, cut with „…" and whole on hover, as #38.50 does
 * for every cell.
 *
 * Slice #38.58: the neutral name is left out when it only repeats the pair.
 * The one joined cell is the converse triple — neutral, male, female, in that
 * order (`STACKED_FIELDS` in value-list-modal.tsx) — and migration_088 seeds
 * „Frate / Soră" beside „Frate", „Soră", which read „Frate / Soră, Frate, Soră".
 * Adrian: leave only „Frate, Soră". So, when BOTH gendered names are present,
 * the neutral one is dropped if it reads „<male> / <female>" (the spaces around
 * „/" ignored) or is just one of the two („Vânzător, Vânzător, Vânzătoare" →
 * „Vânzător, Vânzătoare"; the header's Ask-first #1, recommended answer taken).
 * „Copil, Fiu, Fiică" is not that pattern and stays whole. DISPLAY ONLY: the
 * stored neutral name is still what a person with no gender set is shown
 * (#37.28), and the role editor (#38.36) keeps its three fields.
 *
 * PURE — `joined-cell.test.ts` covers it; value-list-modal.tsx renders it.
 */

const clean = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

/** „A / B", „A/B" and „A  /  B" read the same: the spaces around „/" do not count. */
const slashKey = (s: string): string => s.replace(/\s*\/\s*/g, "/");

/**
 * Slice #38.58: is `neutral` only a repeat of the pair — „<male> / <female>", or one of
 * the two names alone? False unless both gendered names are present.
 */
export function neutralRepeatsPair(neutral: unknown, male: unknown, female: unknown): boolean {
  const n = clean(neutral);
  const m = clean(male);
  const f = clean(female);
  if (n === "" || m === "" || f === "") return false;
  return slashKey(n) === slashKey(`${m}/${f}`) || n === m || n === f;
}

/**
 * The cell's text: the non-blank values joined with „, ", or „–" when every one is blank.
 * Three values are the converse triple (neutral, male, female): a neutral name that only
 * repeats the pair is left out (#38.58).
 */
export function joinedCellText(values: readonly unknown[]): string {
  const shown = (values.length === 3 && neutralRepeatsPair(values[0], values[1], values[2]) ? values.slice(1) : values)
    .map(clean)
    .filter((v) => v !== "");
  return shown.length > 0 ? shown.join(", ") : "–";
}
