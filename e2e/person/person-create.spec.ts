/**
 * Case:   TC-PERS-01 — Persoană fizică creată manual
 * Source: docs/testing/cases/TC-PERS-01.md, „Last green" 2026-09-22
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - „Nume" is `TC-E2E-PERS-01`, not `TC-PERS-01` — a spec's rows carry the
 *     TC-E2E- marker (e2e/helpers/records.ts). So step 6 reads
 *     `Ion TC-E2E-PERS-01` and step 7 types `TC-E2E-PERS`.
 *   - The case leaves its person for TC-ASSOC-01 and TC-SRCH-01. A spec may
 *     not, so the case's own cleanup — „Șterge", „Da" — runs at the end, and a
 *     `finally` removes the row through the same DELETE route if the test
 *     stopped before that.
 *   - No CNP, exactly as the case: a synthetic record carries no real
 *     identifier.
 *   - Slice #37.12 — fixed widths. The form of step 2 and the saved person
 *     opened for the cleanup are both checked at 1400 and 2400 px: every box
 *     and panel is the same width at both (`e2e/helpers/field-widths.ts`), every
 *     FIXED box holds its widest value, and „Locul nașterii" grows downward,
 *     never sideways, and turns a pasted line break into a space. The saved
 *     person is photographed at 1366, 1920 and 2560 px into
 *     `playwright-report/layout/` (gitignored) for the handover — a synthetic record, so no
 *     redaction is needed (capture-and-personal-data.md).
 *   - Slice #37.16 checks the list's fixed column widths here: every column the
 *     same width at 1400 and 2400 px, the table no wider than its columns, and
 *     no fixed column's cell wider than the column. Not a step of the case.
 *   - Slice #37.17: before the cleanup, „Toate" shows every tile of the saved
 *     person; their widths are held at 1400 and 2400 px and photographed at
 *     1920 and 2560 px, then „Implicit" puts the default back.
 *   - Slice #37.27: the tiles sit on a width unit, checked by `expectUnitGrid`.
 *   - Slice #37.26: every label sits above its box and each form tile is as
 *     wide as its widest row, so the tile check is given those widths; the
 *     pictures are 1400 px high, the stacked form being taller than 1000.
 */

import { test, expect } from "@playwright/test";
import { E2E_MARKER, removeLeftovers, removeRecord } from "../helpers/records";
import { openFromSidebar } from "../helpers/sidebar";
import { expectFixedFieldsHold, expectStableColumns, expectStableWidths, expectUnitGrid, photograph } from "../helpers/field-widths";
import { TILE_GROUP } from "../helpers/tiles";
import { ADDRESS, NATURAL_PERSON, UNIT_GAP_REM, UNIT_REM } from "../../src/lib/ui/field-widths";

/** Each FIXED box's widest value, by the name its box carries (Slice #37.12). */
const SAMPLES: Record<string, string> = {};
for (const [k, w] of Object.entries(NATURAL_PERSON)) if ("sample" in w) SAMPLES[k] = w.sample;
for (const [k, w] of Object.entries(ADDRESS)) {
  if ("sample" in w) for (const kind of ["HOME", "CORRESPONDENCE"]) SAMPLES[`addresses.${kind}.${k}`] = w.sample;
}

const LAST_NAME = `${E2E_MARKER}PERS-01`;
const LISTED_AS = `Ion ${LAST_NAME}`; // prenume first, as the list renders it

test.describe("TC-PERS-01 — Persoană fizică creată manual", () => {
  test("creare manuală, rândul nou apare și se găsește, apoi ștergere", async ({ page }) => {
    // Room for the `finally`: an action waiting on a locator that never matches
    // spends the whole default 30 s, and the cleanup after it then dies of the
    // same timeout, leaving a TC-E2E- row for the next run's removeLeftovers.
    test.slow();
    await removeLeftovers(page.request, LAST_NAME);

    let personId: string | undefined;
    try {
      // Step 1 — „Persoane Fizice" in the left sidebar.
      await page.goto("/");
      await openFromSidebar(page, "Persoane Fizice");
      await expect(page.getByRole("heading", { name: "Persoană fizică", exact: true })).toBeVisible({ timeout: 30_000 });
      for (const col of ["COD", "NUME", "PORECLĂ"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: false }).first()).toBeVisible();
      }

      // Step 2 — „Adaugă persoană" goes STRAIGHT to the form; no chooser.
      await page.getByRole("link", { name: "Adaugă persoană" }).click();
      await expect(page).toHaveURL(/\/natural-persons\/new$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Persoană fizică nouă" })).toBeVisible({ timeout: 30_000 });
      for (const section of ["IDENTITATE", "CARTE DE IDENTITATE", "CONTACT", "ADRESĂ DOMICILIU"]) {
        await expect(page.getByText(section).first()).toBeVisible();
      }

      // Slice #37.12 — the same widths at 1400 and 2400 px; every FIXED box holds its value.
      await expectStableWidths(page);
      await expectFixedFieldsHold(page, SAMPLES);
      // „Locul nașterii" grows downward: taller with a long value, never wider;
      // a pasted line break becomes a space, because it is one value.
      const place = page.locator('[data-width-field="placeOfBirth"]');
      const oneLine = await place.boundingBox();
      await place.fill(`Localitatea ${"Foarte ".repeat(8)}Lungă\nJudețul Exemplu`);
      await expect(place).toHaveValue(/^Localitatea (Foarte ){8}Lungă Județul Exemplu$/);
      const grown = await place.boundingBox();
      expect(grown?.width).toBe(oneLine?.width);
      expect(grown?.height ?? 0).toBeGreaterThan((oneLine?.height ?? 0) + 10);

      // Steps 3–4 — „Nume" and „Prenume".
      await page.getByLabel(/^Nume(\s|$)/).fill(LAST_NAME);
      await page.getByLabel(/^Prenume(\s|$)/).fill("Ion");

      // Step 5 — „Salvează"; back to the LIST.
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page).toHaveURL(/\/natural-persons$/, { timeout: 30_000 });

      // Step 6 — at the top: „Nou!", a `PPERS` code, „Ion TC-E2E-PERS-01", „—".
      const top = page.getByRole("row").nth(1);
      await expect(top).toContainText(LISTED_AS, { timeout: 15_000 });
      await expect(top).toContainText("Nou!");
      await expect(top).toContainText(/PPERS\d+/);
      await expect(top).toContainText("—");
      const href = await top.getByRole("link", { name: "Deschide" }).getAttribute("href");
      personId = href?.split("/").pop();
      await expectStableColumns(page);

      // Step 7 — the list's search finds it by the prefix.
      await page.getByPlaceholder("caută după cod, nume, email sau telefon").fill(`${E2E_MARKER}PERS`);
      await expect(page.getByRole("row").filter({ hasText: LISTED_AS })).toHaveCount(1, { timeout: 15_000 });

      // ── At the end — the case's cleanup, through the UI ──────────────────
      await page.getByRole("row").filter({ hasText: LISTED_AS }).getByRole("link", { name: "Deschide" }).click();

      // Slice #37.12 — the saved person at fixed widths, and its pictures for the handover.
      await expect(page.locator('[data-panel="identity"]')).toBeVisible({ timeout: 30_000 });
      await expectStableWidths(page);
      await expectFixedFieldsHold(page, SAMPLES);
      const viewport = page.viewportSize();
      for (const width of [1366, 1920, 2560]) {
        // 1400 px high since #37.26: with every label above its box the form is taller than 1000.
        await page.setViewportSize({ width, height: 1400 });
        // playwright-report/, not test-results/: Playwright empties test-results/ at the start of
        // every run, including the runner's re-run of a failed spec, which would take these with it.
        await page.screenshot({ path: `playwright-report/layout/natural-person-${width}.png`, fullPage: true });
      }
      if (viewport) await page.setViewportSize(viewport);
      // Slice #37.17 — every tile at once („Toate"), its widths held, and its pictures; then „Implicit".
      await page.getByRole("group", { name: TILE_GROUP }).getByRole("button", { name: "Toate", exact: true }).click();
      await expect(page.getByRole("region", { name: "META INFO", exact: true })).toBeVisible({ timeout: 30_000 });
      await expectStableWidths(page);
      // Slice #37.27 — the tiles are on a width unit: the row is 6 units at 1366 px, 10 at 1920,
      // 14 at 2560, and every tile and panel is a whole number of units (replaces #37.23's
      // two / three / four 32rem tiles to a row).
      await expectUnitGrid(page, UNIT_REM, UNIT_GAP_REM, { 1366: 6, 1920: 10, 2560: 14 });
      await photograph(page, "natural-person-all-tiles", [1920, 2560], 1400);
      await page.getByRole("group", { name: TILE_GROUP }).getByRole("button", { name: "Implicit", exact: true }).click();
      await expect(page.getByRole("region", { name: "META INFO", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Șterge", exact: true }).click();
      const confirm = page.getByRole("dialog", { name: "Ștergeți persoana?" });
      await expect(confirm.getByRole("button", { name: "Nu", exact: true })).toBeVisible();
      await confirm.getByRole("button", { name: "Da", exact: true }).click();
      await expect(page).toHaveURL(/\/natural-persons$/, { timeout: 30_000 });
      await expect(page.getByRole("row").filter({ hasText: LISTED_AS })).toHaveCount(0);
    } finally {
      if (personId) await removeRecord(page.request, "person", personId);
    }
  });
});
