/**
 * „Do the shares on this deed add up?” — per role, warning, never refusing.
 *                                                              (Slice #36.02)
 *
 * WHAT IT ANSWERS
 *   For each role present on a document, the sum of its rows' `cota_parte`, so
 *   a deed whose sellers come to 99,99% is visible at a glance rather than
 *   discovered three years later.
 *
 * ⚠️ **IT WARNS. IT DOES NOT BLOCK, AND NOTHING MAY MAKE IT BLOCK.** A 2006
 * deed that genuinely states no shares must still be savable. A deed that
 * really does total 99,99% because the notary rounded must still be savable.
 * The archive's job is to show the user what the paper says, not to refuse the
 * paper — and a rule that refused would mean the fact simply never gets
 * recorded, which is worse than recording it wrong and saying so. This is the
 * same sentence migration_084 gives for leaving `cota_parte` without a range
 * CHECK, and `role-stranding.ts` gives for its own sentence-not-refusal.
 *
 * ⚠️ **NO ROLE NAME IS HARD-CODED ANYWHERE IN HERE.** It groups by whatever
 * `personRoleId` values the document actually holds, so it works unchanged for
 * a partaj with five coindivizari, for a donation, and for a role invented next
 * year in Reference Data. `roleName` is carried through for display only and is
 * never read.
 *
 * ⚠️ **A NULL COTA CONTRIBUTES NOTHING AND IS NOT AN ERROR.** A notary has no
 * share and a mandatar usually has none. A role in which NO row carries a cota
 * gets `state: "silent"` and says nothing at all — the empty box is the
 * ordinary case, not an omission to nag about.
 *
 * ---------------------------------------------------------------------------
 * DEVALMASIE, WHICH IS THE WHOLE REASON THIS IS A FUNCTION AND NOT A `sum()`
 * ---------------------------------------------------------------------------
 *
 * In `5-CVC 2-2-5000 CRH 2016` the sellers are „sotii SIMON, 60%” and „sotii
 * PRISECARU, 40%” — FOUR PEOPLE AND TWO SHARES. Comunitate devalmasa has no
 * determinate shares between the spouses, so 30/30 is legally wrong and 60 on
 * both rows makes the sellers total 200%.
 *
 * THE RULE: within one role, rows that carry `cotaMod === "DEVALMASIE"` and the
 * same `cotaParte` are ONE block and are counted ONCE. Everything else is
 * counted per row.
 *
 * ⚠️ **AND THAT RULE FOLDS TWO UNRELATED COUPLES WHO HAPPEN TO HOLD THE SAME
 * SHARE, WHICH IS A KNOWN AND ACCEPTED LOSS.** Two devalmasie couples selling
 * 25% each in one role are indistinguishable here from one couple selling 25%,
 * so the total reads 25 where 50 is right, and the warning fires on a deed that
 * is correct. It is accepted because the alternative is a block identifier on
 * the row — a fifth column, entered by hand, on a screen where the four that
 * exist are already more than the common case needs — to buy correctness in a
 * case nobody has yet seen in this archive. `blocksFolded` is on the result so
 * the day one turns up, the screen can say which rows were folded instead of
 * the archive quietly disagreeing with the deed. When that day comes, the
 * change is a block column and this rule keyed on it; it is in the handover.
 *
 * ⚠️ **THE ARITHMETIC IS IN INTEGER TEN-THOUSANDTHS, NOT IN FLOATS — AND
 * THE OBVIOUS EXAMPLE FOR THAT IS WRONG, WHICH IS WHY THE REAL ONE IS HERE.**
 * A first draft justified this with 63,64 + 9,09 + 27,27, „which is
 * 99.99999999999999 in IEEE 754”. Measured: it is exactly 100. So are
 * 33,33 + 33,33 + 33,34, and every other TWO-decimal set tried — the sum
 * rounds back onto the double that is 100, and a float `=== 100` would have
 * been right every time.
 *
 * It is the FOURTH decimal that breaks it, which is exactly the precision
 * migration_084 chose the column for. Measured:
 *
 *   12,7689 + 21,4166 + 20,1228 + 18,3975 + 27,2942 === 100.00000000000001
 *   11,5552 + 21,88   +  1,9764 + 64,5884           ===  99.99999999999999
 *
 * A float comparison would report both of those deeds — which close exactly —
 * as off by a rounding error, which is this function's one job done backwards.
 * So every value is scaled by 10_000 (the column's own precision) and rounded
 * to an integer before a single addition happens. The reason is real; the
 * sentence that was first written for it was not, and it is corrected rather
 * than deleted so the same false example is not reached for again.
 */

import type { CotaMod } from "./cota-parte";

/** One `person_document` row, reduced to what the rule reads. */
export type CotaRow = {
  /** `person_document.person_role_id`. NULL is a group of its own: „no role”. */
  roleId: string | null;
  /** Display only. Never read by the rule. */
  roleName: string | null;
  cotaParte: number | null;
  cotaMod: CotaMod | null;
};

export type RoleCotaTotal = {
  roleId: string | null;
  roleName: string | null;
  /** The sum, as a percentage, with devalmasie blocks counted once. */
  total: number;
  /** Rows that carried a cota. Folded block members are counted individually. */
  rowsWithCota: number;
  /** Rows in this role with no cota at all. Never an error. */
  rowsWithoutCota: number;
  /** How many rows disappeared into a devalmasie fold (0 when none did). */
  blocksFolded: number;
  /**
   * `silent`  — no row in this role carries a cota. Show nothing.
   * `closes`  — the total is exactly 100%.
   * `off`     — it is not. Show the total and the warning; save anyway.
   */
  state: "silent" | "closes" | "off";
};

/** The column is numeric(7,4), so ten-thousandths are the exact unit. */
const SCALE = 10_000;
const WHOLE = 100 * SCALE;

/**
 * One pass, grouping by `roleId` and preserving the order the roles first
 * appear in `rows` — which is the order the caller is already rendering them
 * in, so the total line lands beside its own role without a second sort.
 */
export function cotaTotalsByRole(rows: readonly CotaRow[]): RoleCotaTotal[] {
  type Acc = {
    roleId: string | null;
    roleName: string | null;
    units: number;
    rowsWithCota: number;
    rowsWithoutCota: number;
    blocksFolded: number;
    /** Scaled cota values already counted for a DEVALMASIE block in this role. */
    seenBlocks: Set<number>;
  };

  // `roleId` is `string | null` and a Map keys those apart correctly, so the
  // role-less group needs no sentinel.
  const byRole = new Map<string | null, Acc>();

  for (const row of rows) {
    let acc = byRole.get(row.roleId);
    if (!acc) {
      acc = {
        roleId: row.roleId,
        roleName: row.roleName,
        units: 0,
        rowsWithCota: 0,
        rowsWithoutCota: 0,
        blocksFolded: 0,
        seenBlocks: new Set<number>(),
      };
      byRole.set(row.roleId, acc);
    }
    // The first row of a role names it; a later row of the same role with a
    // name where the first had none fills the gap rather than being ignored.
    if (acc.roleName === null && row.roleName !== null) acc.roleName = row.roleName;

    if (row.cotaParte === null || !Number.isFinite(row.cotaParte)) {
      acc.rowsWithoutCota += 1;
      continue;
    }

    acc.rowsWithCota += 1;
    const units = Math.round(row.cotaParte * SCALE);

    if (row.cotaMod === "DEVALMASIE") {
      if (acc.seenBlocks.has(units)) {
        acc.blocksFolded += 1;
        continue;
      }
      acc.seenBlocks.add(units);
    }

    acc.units += units;
  }

  return Array.from(byRole.values(), (acc) => ({
    roleId: acc.roleId,
    roleName: acc.roleName,
    total: acc.units / SCALE,
    rowsWithCota: acc.rowsWithCota,
    rowsWithoutCota: acc.rowsWithoutCota,
    blocksFolded: acc.blocksFolded,
    state: acc.rowsWithCota === 0 ? "silent" : acc.units === WHOLE ? "closes" : "off",
  }));
}
