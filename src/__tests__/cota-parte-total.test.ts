/**
 * @jest-environment node
 */

/**
 * Slice #36.02 — the per-role total, and the two cases the slice named.
 *
 * WHAT THIS FILE PINS, AND WHY EACH ONE
 *   1. `5-CVC 2-2-5000 CRH 2016` itself: FOUR sellers and TWO shares, because
 *      two of them are „sotii SIMON, 60%” and two are „sotii PRISECARU, 40%”.
 *      Comunitate devalmasa has no determinate shares between spouses, so 30/30
 *      is legally wrong and 60 on both rows makes the sellers total 200%. The
 *      devalmasie fold is the whole reason this is a function and not a sum,
 *      and this is the deed that proves it.
 *   2. The 99,99% deed: it is „off”, and it SAVES. The state is a warning and
 *      nothing in the result may be readable as a refusal.
 *   3. A deed with no shares at all is SILENT — not „0%”, not „off”. A notary
 *      and a mandatar have no share and the empty box is the ordinary case.
 *   4. That the arithmetic is exact. 63,64 + 9,09 + 27,27 is
 *      99.99999999999999 in IEEE 754, so a float comparison would report a deed
 *      that closes exactly as off by a rounding error — this function's one job,
 *      done backwards.
 *   5. That NO role name is read. The rule groups by role id, so it works for a
 *      partaj with five coindivizari and for a role invented next year.
 */

import { cotaTotalsByRole, type CotaRow } from "@/lib/documents/cota-parte-total";

const VANZATOR = "11111111-1111-1111-1111-111111111111";
const CUMPARATOR = "22222222-2222-2222-2222-222222222222";
const MANDATAR = "33333333-3333-3333-3333-333333333333";

function row(over: Partial<CotaRow> & Pick<CotaRow, "roleId">): CotaRow {
  return { roleName: null, cotaParte: null, cotaMod: null, ...over };
}

describe("5-CVC 2-2-5000 CRH 2016 — four sellers, two shares", () => {
  const sellers: CotaRow[] = [
    row({ roleId: VANZATOR, roleName: "Vânzător", cotaParte: 60, cotaMod: "DEVALMASIE" }),
    row({ roleId: VANZATOR, roleName: "Vânzător", cotaParte: 60, cotaMod: "DEVALMASIE" }),
    row({ roleId: VANZATOR, roleName: "Vânzător", cotaParte: 40, cotaMod: "DEVALMASIE" }),
    row({ roleId: VANZATOR, roleName: "Vânzător", cotaParte: 40, cotaMod: "DEVALMASIE" }),
  ];

  it("counts each devalmasie block once, so the deed closes at 100", () => {
    const [total] = cotaTotalsByRole(sellers);
    expect(total.total).toBe(100);
    expect(total.state).toBe("closes");
  });

  it("names the four rows and the two that were folded", () => {
    const [total] = cotaTotalsByRole(sellers);
    expect(total.rowsWithCota).toBe(4);
    expect(total.blocksFolded).toBe(2);
    expect(total.rowsWithoutCota).toBe(0);
  });

  it("would read 200% without the fold, which is the defect it prevents", () => {
    const naive = sellers.reduce((sum, r) => sum + (r.cotaParte ?? 0), 0);
    expect(naive).toBe(200);
  });

  it("does not fold two spouses who are NOT in devalmasie", () => {
    // Same role, same share, no DEVALMASIE: two coindivizari at 50% each, which
    // is a real and different thing, and must total 100 rather than 50.
    const indiviziune: CotaRow[] = [
      row({ roleId: VANZATOR, cotaParte: 50, cotaMod: "INDIVIZIUNE" }),
      row({ roleId: VANZATOR, cotaParte: 50, cotaMod: "INDIVIZIUNE" }),
    ];
    const [total] = cotaTotalsByRole(indiviziune);
    expect(total.total).toBe(100);
    expect(total.blocksFolded).toBe(0);
  });

  it("folds only within one role, never across two", () => {
    const mixed: CotaRow[] = [
      row({ roleId: VANZATOR, cotaParte: 100, cotaMod: "DEVALMASIE" }),
      row({ roleId: CUMPARATOR, cotaParte: 100, cotaMod: "DEVALMASIE" }),
    ];
    const totals = cotaTotalsByRole(mixed);
    expect(totals).toHaveLength(2);
    expect(totals.every((t) => t.state === "closes")).toBe(true);
    expect(totals.every((t) => t.blocksFolded === 0)).toBe(true);
  });

  it("folds only identical shares, not merely both devalmasie", () => {
    const twoCouples: CotaRow[] = [
      row({ roleId: VANZATOR, cotaParte: 60, cotaMod: "DEVALMASIE" }),
      row({ roleId: VANZATOR, cotaParte: 60, cotaMod: "DEVALMASIE" }),
      row({ roleId: VANZATOR, cotaParte: 40, cotaMod: "DEVALMASIE" }),
    ];
    const [total] = cotaTotalsByRole(twoCouples);
    expect(total.total).toBe(100);
    expect(total.blocksFolded).toBe(1);
  });

  it("ACCEPTS the known loss: two unrelated couples on the same share fold", () => {
    // Two devalmasie couples each selling 25% read as 25, not 50, and the
    // warning fires on a deed that is correct. The fix is a block column on the
    // row; it is in the handover, not in this rule. Pinned so the loss is a
    // recorded decision rather than a surprise.
    const twoCouplesSameShare: CotaRow[] = [
      row({ roleId: VANZATOR, cotaParte: 25, cotaMod: "DEVALMASIE" }),
      row({ roleId: VANZATOR, cotaParte: 25, cotaMod: "DEVALMASIE" }),
      row({ roleId: VANZATOR, cotaParte: 25, cotaMod: "DEVALMASIE" }),
      row({ roleId: VANZATOR, cotaParte: 25, cotaMod: "DEVALMASIE" }),
    ];
    const [total] = cotaTotalsByRole(twoCouplesSameShare);
    expect(total.total).toBe(25);
    expect(total.state).toBe("off");
    expect(total.blocksFolded).toBe(3);
  });
});

describe("the 99,99% deed — off, and saved anyway", () => {
  it("is „off” and reports the total the paper states", () => {
    const rows: CotaRow[] = [
      row({ roleId: VANZATOR, cotaParte: 33.33 }),
      row({ roleId: VANZATOR, cotaParte: 33.33 }),
      row({ roleId: VANZATOR, cotaParte: 33.33 }),
    ];
    const [total] = cotaTotalsByRole(rows);
    expect(total.total).toBe(99.99);
    expect(total.state).toBe("off");
  });

  it("carries nothing a caller could read as a refusal", () => {
    const [total] = cotaTotalsByRole([row({ roleId: VANZATOR, cotaParte: 99.99 })]);
    expect(Object.keys(total).sort()).toEqual([
      "blocksFolded",
      "roleId",
      "roleName",
      "rowsWithCota",
      "rowsWithoutCota",
      "state",
      "total",
    ]);
    expect(["silent", "closes", "off"]).toContain(total.state);
  });

  it("is equally „off” when the deed comes to more than 100", () => {
    const [total] = cotaTotalsByRole([
      row({ roleId: VANZATOR, cotaParte: 60 }),
      row({ roleId: VANZATOR, cotaParte: 60 }),
    ]);
    expect(total.total).toBe(120);
    expect(total.state).toBe("off");
  });
});

describe("the arithmetic is exact, in ten-thousandths", () => {
  it("the archive's own 63,64 / 9,09 / 27,27 closes at 100", () => {
    const [total] = cotaTotalsByRole([
      row({ roleId: VANZATOR, cotaParte: 63.64 }),
      row({ roleId: VANZATOR, cotaParte: 9.09 }),
      row({ roleId: VANZATOR, cotaParte: 27.27 }),
    ]);
    expect(total.total).toBe(100);
    expect(total.state).toBe("closes");
  });

  it("closes on the four-decimal sets a float sum gets WRONG", () => {
    // These two are the measured counterexamples in the module header. A float
    // `=== 100` reports both as off by a rounding error; two-decimal sets, which
    // an earlier draft of that header used as its example, all land exactly and
    // would have proved nothing.
    expect(12.7689 + 21.4166 + 20.1228 + 18.3975 + 27.2942).not.toBe(100);
    expect(11.5552 + 21.88 + 1.9764 + 64.5884).not.toBe(100);

    for (const shares of [
      [12.7689, 21.4166, 20.1228, 18.3975, 27.2942],
      [11.5552, 21.88, 1.9764, 64.5884],
    ]) {
      const [total] = cotaTotalsByRole(
        shares.map((cotaParte) => row({ roleId: VANZATOR, cotaParte })),
      );
      expect(total.total).toBe(100);
      expect(total.state).toBe("closes");
    }
  });

  it("holds the column's fourth decimal", () => {
    const [total] = cotaTotalsByRole([
      row({ roleId: VANZATOR, cotaParte: 33.3333 }),
      row({ roleId: VANZATOR, cotaParte: 33.3333 }),
      row({ roleId: VANZATOR, cotaParte: 33.3334 }),
    ]);
    expect(total.total).toBe(100);
  });

  it("three thirds rounded to four decimals do NOT close, and say so", () => {
    const [total] = cotaTotalsByRole([
      row({ roleId: VANZATOR, cotaParte: 33.3333 }),
      row({ roleId: VANZATOR, cotaParte: 33.3333 }),
      row({ roleId: VANZATOR, cotaParte: 33.3333 }),
    ]);
    expect(total.total).toBe(99.9999);
    expect(total.state).toBe("off");
  });
});

describe("a null cota contributes nothing and is never an error", () => {
  it("a deed with no shares at all is silent", () => {
    const totals = cotaTotalsByRole([
      row({ roleId: VANZATOR, roleName: "Vânzător" }),
      row({ roleId: VANZATOR, roleName: "Vânzător" }),
      row({ roleId: CUMPARATOR, roleName: "Cumpărător" }),
    ]);
    expect(totals.map((t) => t.state)).toEqual(["silent", "silent"]);
    expect(totals.map((t) => t.total)).toEqual([0, 0]);
    expect(totals.map((t) => t.rowsWithoutCota)).toEqual([2, 1]);
  });

  it("a notary alongside sellers who close costs nothing", () => {
    const totals = cotaTotalsByRole([
      row({ roleId: VANZATOR, cotaParte: 100 }),
      row({ roleId: MANDATAR, roleName: "Reprezentant legal / Mandatar" }),
    ]);
    const byRole = new Map(totals.map((t) => [t.roleId, t]));
    expect(byRole.get(VANZATOR)?.state).toBe("closes");
    expect(byRole.get(MANDATAR)?.state).toBe("silent");
  });

  it("a partly-filled role still totals what it has, and warns", () => {
    const [total] = cotaTotalsByRole([
      row({ roleId: VANZATOR, cotaParte: 50 }),
      row({ roleId: VANZATOR }),
    ]);
    expect(total.total).toBe(50);
    expect(total.rowsWithCota).toBe(1);
    expect(total.rowsWithoutCota).toBe(1);
    expect(total.state).toBe("off");
  });
});

describe("grouping is by role id and by nothing else", () => {
  it("reads no role name — two roles sharing a name stay apart", () => {
    const totals = cotaTotalsByRole([
      row({ roleId: VANZATOR, roleName: "Vânzător", cotaParte: 100 }),
      row({ roleId: CUMPARATOR, roleName: "Vânzător", cotaParte: 50 }),
    ]);
    expect(totals).toHaveLength(2);
    expect(totals.map((t) => t.total)).toEqual([100, 50]);
  });

  it("the role-less rows are a group of their own", () => {
    const totals = cotaTotalsByRole([
      row({ roleId: null, cotaParte: 50 }),
      row({ roleId: null, cotaParte: 50 }),
      row({ roleId: VANZATOR, cotaParte: 100 }),
    ]);
    expect(totals).toHaveLength(2);
    expect(totals[0].roleId).toBeNull();
    expect(totals[0].state).toBe("closes");
  });

  it("keeps the order the roles first appear in, so the line lands beside its row", () => {
    const totals = cotaTotalsByRole([
      row({ roleId: CUMPARATOR, cotaParte: 100 }),
      row({ roleId: VANZATOR, cotaParte: 100 }),
      row({ roleId: CUMPARATOR, cotaParte: 0 }),
    ]);
    expect(totals.map((t) => t.roleId)).toEqual([CUMPARATOR, VANZATOR]);
  });

  it("takes the role name from whichever row first carries one", () => {
    const totals = cotaTotalsByRole([
      row({ roleId: VANZATOR, roleName: null, cotaParte: 50 }),
      row({ roleId: VANZATOR, roleName: "Vânzător", cotaParte: 50 }),
    ]);
    expect(totals[0].roleName).toBe("Vânzător");
  });

  it("works unchanged for a partaj with five coindivizari", () => {
    const partaj: CotaRow[] = Array.from({ length: 5 }, () =>
      row({ roleId: MANDATAR, roleName: "Coindivizar", cotaParte: 20 }),
    );
    const [total] = cotaTotalsByRole(partaj);
    expect(total.total).toBe(100);
    expect(total.state).toBe("closes");
  });

  it("an empty document produces no lines at all", () => {
    expect(cotaTotalsByRole([])).toEqual([]);
  });
});
