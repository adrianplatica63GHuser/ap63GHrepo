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
 * TC-ASSOC-07 spec meets one order per run, this one creates one whole and
 * then parts until it holds a part whose uuid sorts BEFORE the whole's and a
 * part whose uuid sorts AFTER it (the case's step 7), and drives steps 2–6 for
 * each. The order itself is also pinned in jest,
 * `src/__tests__/property-relation-direction.test.ts`.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - Step 1's properties are created through the POST route the „Introducere
 *     manuală" form calls (`createProperty`), not through the form: TC-PROP-01's
 *     spec drives that form, and here the records are prerequisites, and their
 *     number is not known in advance.
 *   - The names carry `TC-E2E-ASSOC-08` where the case's carry `TC-ASSOC-08`.
 *   - The cleanup's „Dezasociază" runs on the last pair; every property is
 *     removed in `finally` through DELETE /api/properties/[id], the route
 *     „Șterge" → „Da" calls (the link is ON DELETE CASCADE).
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}ASSOC-08`;
const WHOLE = `${MARK} Teren întreg`;
const ROLE = "Inclus în";
const ROLES = [
  "— fără relație —",
  "Adiacent",
  "Inclus în",
  "Contiguu",
  "Subdiviziune a",
  "Suprapus cu",
  "Acces prin",
  "Alipit de",
];
/** Parts created while looking for one of each sort order; far more than chance needs. */
const MAX_PARTS = 16;

/**
 * The property's code (`PROP…`), read from GET /api/properties/[id] — the
 * route the property's screen loads. Not from the page text: the sidebar's
 * „RECENTE" lists other properties' codes too.
 */
async function codeOf(page: Page, id: string): Promise<string> {
  const res = await page.request.get(`/api/properties/${id}`);
  expect(res.ok(), `GET /api/properties/${id} failed (${res.status()})`).toBeTruthy();
  const code = ((await res.json()) as { property?: { code?: string } }).property?.code;
  expect(code, `no code on property ${id}`).toMatch(/^PROP\d+$/);
  return code as string;
}

/** Steps 2–6 for one pair: link from the part's screen, read from both ends. */
async function linkAndRead(page: Page, part: { id: string; name: string }, whole: { id: string; code: string }) {
  // Step 2 — the part's „Asocieri": empty, „Asociază", „Dezasociază".
  await page.goto(`/properties/${part.id}`);
  await expect(page.getByRole("heading", { name: part.name })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "Asocieri" }).click();
  await expect(page.getByText("Nicio proprietate corelată")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();

  // Step 3 — „Asociere proprietate corelată": „Căutare", Cod · Denumire, „Tip relație".
  await page.getByRole("button", { name: "Asociază", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/properties/${part.id}/associate-reference$`), { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Asociere proprietate corelată" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(part.name).first()).toBeVisible();
  const search = page.getByPlaceholder("Cod sau denumire…", { exact: true });
  for (const col of ["Cod", "Denumire"]) {
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
  await expect(fromPart).toContainText(`această proprietate „${ROLE}” ${whole.code}`);
  await expect(fromPart.getByRole("button", { name: "Vizualizare" })).toBeVisible();

  // Step 6 — the whole's „Asocieri": the converse, with the part's code.
  const partCode = await codeOf(page, part.id);
  await page.goto(`/properties/${whole.id}`);
  await expect(page.getByRole("heading", { name: WHOLE })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "Asocieri" }).click();
  const fromWhole = page.getByRole("row").filter({ has: page.getByRole("radio", { name: part.name }) });
  await expect(fromWhole).toHaveCount(1, { timeout: 30_000 });
  await expect(fromWhole).toContainText(`${partCode} „${ROLE}” această proprietate`);
}

test.describe("TC-ASSOC-08 — Proprietate inclusă în alta, citită din ambele capete", () => {
  test("„Inclus în” ales din parte se citește așa din parte și invers din întreg, pe ambele ordini de uuid", async ({ page }) => {
    test.slow();
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
      // Step 1 — the whole, then parts until both sort orders are in hand (step 7).
      const wholeId = await createProperty(page.request, { nickname: WHOLE });
      created.push(wholeId);
      let before: { id: string; name: string } | undefined;
      let after: { id: string; name: string } | undefined;
      for (let n = 1; n <= MAX_PARTS && !(before && after); n++) {
        const name = `${MARK} Parcelă inclusă ${n}`;
        const id = await createProperty(page.request, { nickname: name });
        created.push(id);
        if (id < wholeId) before ??= { id, name };
        else after ??= { id, name };
      }
      expect(before && after, `no part of each sort order in ${MAX_PARTS} tries`).toBeTruthy();

      const whole = { id: wholeId, code: await codeOf(page, wholeId) };
      await linkAndRead(page, before!, whole);
      await linkAndRead(page, after!, whole);

      // ── At the end — radio, „Dezasociază", on the whole's „Asocieri" ─────
      for (const part of [before!, after!]) {
        await page.getByRole("radio", { name: part.name }).check();
        await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
        await expect(page.getByRole("radio", { name: part.name })).toHaveCount(0, { timeout: 15_000 });
      }
      await expect(page.getByText("Nicio proprietate corelată")).toBeVisible({ timeout: 15_000 });
    } finally {
      for (const id of created) await removeRecord(page.request, "property", id);
    }
  });
});
