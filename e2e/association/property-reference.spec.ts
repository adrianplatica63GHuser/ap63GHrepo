/**
 * Case:   TC-ASSOC-08 — Proprietate inclusă în alta, citită din ambele capete
 * Source: docs/testing/cases/TC-ASSOC-08.md, „Last green" 2026-09-27
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * ⚠️ **BOTH SORT ORDERS IN EVERY RUN, NOT BY CHANCE.** `property_property`
 * stores a pair in uuid order, and the defect this guards (FU-220) was
 * invisible on exactly the pairs whose uuids sorted one way. So, where the
 * TC-ASSOC-07 spec meets one order per run, this one makes three properties
 * and names them by where their uuids sort: the whole in the middle, a part
 * that sorts BEFORE it and a part that sorts AFTER it (the case's step 7, and
 * POOL below), and drives steps 2–6 for each. The order itself is also pinned in jest,
 * `src/__tests__/property-relation-direction.test.ts`.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - Step 1's properties are created through the POST route the „Introducere
 *     manuală" form calls (`createProperty`), not through the form: TC-PROP-01's
 *     spec drives that form, and here the records are prerequisites, named
 *     only once their uuids are known (a PATCH of „Poreclă", one version each).
 *   - The names carry `TC-E2E-ASSOC-08` where the case's carry `TC-ASSOC-08`.
 *   - The cleanup's „Dezasociază" runs on the last pair; every property is
 *     removed in `finally` through DELETE /api/properties/[id], the route
 *     „Șterge" → „Da" calls (the link is ON DELETE CASCADE).
 *   - Slice #37.19: a property has no tab row; its „Proprietăți corelate" (steps 2 and 6; „Asocieri" until #37.30)
 *     is a tile, ticked with `showTile` (e2e/helpers/tiles.ts).
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}ASSOC-08`;
const WHOLE = `${MARK} Teren întreg`;
const ROLE = "Inclus în";
const ROLES = [
  "fără relație",
  "Adiacent",
  "Inclus în",
  "Contiguu",
  "Subdiviziune a",
  "Suprapus cu",
  "Acces prin",
  "Alipit de",
];
/**
 * ⚠️ **THREE PROPERTIES, NAMED AFTER THEIR UUIDS SORT — NOT PARTS UNTIL CHANCE
 * OBLIGES.** (Slice #37.19) Until then this spec created the whole first and
 * then up to 16 parts until one sorted before it and one after. A whole whose
 * uuid falls near either end makes that fail: over a uniformly placed whole the
 * chance is 2/17, about one run in eight, and full 20260928T233256Z-25761 met
 * it („no part of each sort order in 16 tries"). Now three properties are made
 * under throwaway names, sorted by uuid, and named for their place: the middle
 * one is the whole, the first and last the two parts. Both orders, every run.
 */
const POOL = 3;

/** Steps 2–6 for one pair: link from the part's screen, read from both ends. */
async function linkAndRead(page: Page, part: { id: string; name: string }, whole: { id: string; name: string }) {
  // Step 2 — the part's „Proprietăți corelate" (#37.30, „Asocieri" before): empty, „Asociază", „Dezasociază".
  await page.goto(`/properties/${part.id}`);
  await expect(page.getByRole("heading", { name: part.name })).toBeVisible({ timeout: 30_000 });
  await showTile(page, "Proprietăți corelate");
  await expect(page.getByText("Nicio proprietate corelată")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();

  // Step 3 — „Asociere proprietate corelată": „Căutare", Denumire, „Tip relație" (#37.57: no „Cod").
  await page.getByRole("button", { name: "Asociază", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/properties/${part.id}/associate-reference$`), { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Asociere proprietate corelată" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(part.name).first()).toBeVisible();
  const search = page.getByPlaceholder("Cod sau denumire…", { exact: true });
  for (const col of ["Denumire"]) {
    await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
  }
  // The select renders only once GET /api/admin/property-property-roles has
  // answered, and on a cold server that route compiles on this first request.
  const relation = page.getByRole("combobox", { name: "Tip relație", exact: true });
  await expect(relation.locator("option")).toHaveText(ROLES, { timeout: 30_000 });

  // Step 4 — the whole's one row, ticked; „Inclus în".
  await search.fill(WHOLE);
  await expect(page.getByRole("row").filter({ hasText: WHOLE })).toHaveCount(1, { timeout: 15_000 });
  await page.getByRole("checkbox", { name: WHOLE }).check();
  await relation.selectOption({ label: ROLE });

  // Step 5 — „Asociază selecția": the part reads „această proprietate „Inclus în” <whole>".
  await page.getByRole("button", { name: "Asociază selecția" }).click();
  await expect(page).toHaveURL(new RegExp(`/properties/${part.id}\\?tab=related$`), { timeout: 30_000 });
  const fromPart = page.getByRole("row").filter({ has: page.getByRole("radio", { name: WHOLE }) });
  await expect(fromPart).toHaveCount(1, { timeout: 15_000 });
  // #37.57: the other property by its name, not its system ID.
  await expect(fromPart).toContainText(`această proprietate „${ROLE}” ${whole.name}`);
  await expect(fromPart.getByRole("link", { name: "Vizualizare" })).toBeVisible();

  // Step 6 — the whole's „Proprietăți corelate": the converse, with the part's name.
  await page.goto(`/properties/${whole.id}`);
  await expect(page.getByRole("heading", { name: WHOLE })).toBeVisible({ timeout: 30_000 });
  await showTile(page, "Proprietăți corelate");
  const fromWhole = page.getByRole("row").filter({ has: page.getByRole("radio", { name: part.name, exact: true }) });
  await expect(fromWhole).toHaveCount(1, { timeout: 30_000 });
  await expect(fromWhole).toContainText(`${part.name} „${ROLE}” această proprietate`);
}

test.describe("TC-ASSOC-08 — Proprietate inclusă în alta, citită din ambele capete", () => {
  test("„Inclus în” ales din parte se citește așa din parte și invers din întreg, pe ambele ordini de uuid", async ({ page }) => {
    // Two pairs, each driven through three screens, and on a cold server the
    // roles and dissociate routes compile on first request (the waits below):
    // more than test.slow()'s tripled default.
    test.setTimeout(300_000);
    await removeLeftovers(page.request, MARK);
    // Ask for the roles once before any screen does. „Tip relație" renders only
    // after GET /api/admin/property-property-roles answers, and on a cold server
    // that route compiles on its first request — in a full run (20260927T113050Z-1886)
    // the compile outlasted the screen's wait. A request waits it out; the
    // screen then finds the route warm.
    const roles = await page.request.get("/api/admin/property-property-roles", { timeout: 120_000 });
    expect(roles.ok(), `GET /api/admin/property-property-roles failed (${roles.status()})`).toBeTruthy();
    const created: string[] = [];

    try {
      // Step 1 — three properties, sorted by uuid: the middle one is the whole,
      // the first sorts before it and the last after it (step 7). See POOL.
      for (let n = 1; n <= POOL; n++) created.push(await createProperty(page.request, { nickname: `${MARK} în lucru ${n}` }));
      const [firstId, wholeId, lastId] = [...created].sort();
      // Found by `exact: true` below, as since full 20260928T205807Z-5800.
      const before = { id: firstId, name: `${MARK} Parcelă inclusă 1` };
      const after = { id: lastId, name: `${MARK} Parcelă inclusă 2` };
      for (const [id, nickname] of [[wholeId, WHOLE], [before.id, before.name], [after.id, after.name]] as const) {
        const res = await page.request.patch(`/api/properties/${id}`, { data: { nickname } });
        expect(res.ok(), `PATCH /api/properties/${id} failed (${res.status()})`).toBeTruthy();
      }
      expect(before.id < wholeId && wholeId < after.id).toBe(true);

      const whole = { id: wholeId, name: WHOLE };
      await linkAndRead(page, before, whole);
      await linkAndRead(page, after, whole);

      // ── At the end — radio, „Dezasociază", on the whole's „Proprietăți corelate" ─
      for (const part of [before, after]) {
        await page.getByRole("radio", { name: part.name, exact: true }).check();
        // The DELETE route compiles on its first request on a cold server
        // (full 20260927T120014Z-6234 ran out of 15 s there): wait for its answer.
        const dissociated = page.waitForResponse(
          (r) => r.request().method() === "DELETE" && /\/api\/properties\/[^/]+\/references\//.test(r.url()),
          { timeout: 120_000 },
        );
        await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
        expect((await dissociated).ok()).toBeTruthy();
        await expect(page.getByRole("radio", { name: part.name, exact: true })).toHaveCount(0, { timeout: 15_000 });
      }
      await expect(page.getByText("Nicio proprietate corelată")).toBeVisible({ timeout: 15_000 });
    } finally {
      for (const id of created) await removeRecord(page.request, "property", id);
    }
  });
});
