/**
 * Case:   TC-ASSOC-09 — Două persoane corelate, citite la fel din ambele capete
 * Source: docs/testing/cases/TC-ASSOC-09.md, „Last green" 2026-09-25
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * ⚠️ **THIS ASSERTS SYMMETRIC READING, BECAUSE THAT IS ALL THE SCREEN CAN DO
 * TODAY.** Since Slice #37.27 ten roles carry „Persoană → Persoană" (Adrian,
 * 2026-09-30: the three he ticked and Soț … Soră), so step 3 offers „Tip
 * relație" — but a role still reads the same from both ends until the
 * direction slice (#37.28), so the case leaves it at „— fără relație —" and
 * the link reads „—" from both ends. #37.28 gives it a directional role.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - Step 1's two people are this spec's own, created through the POST route
 *     the „Adaugă persoană" form calls — „Ana TC-E2E-ASSOC-09" and „Mihai
 *     TC-E2E-ASSOC-09". Driving that form is TC-PERS-01's spec's job.
 *   - Step 4 first types `TC-E2E-ASSOC-09` into „Nume": the case's database
 *     has almost no people, a spec's may have a page of them.
 *   - Step 6 opens Mihai by his address.
 *   - Both are removed in `finally` through DELETE /api/people/[id], after the
 *     case's own cleanup (radio, „Dezasociază") has run.
 *   - Slice #37.17: a Natural Person has no tab row; the person's „Asocieri"
 *     is a tile, ticked with `showTile` (e2e/helpers/tiles.ts) where the hand
 *     run clicks the tile's checkbox.
 */

import { test, expect } from "@playwright/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}ASSOC-09`;
const ANA = `Ana ${MARK}`;
const MIHAI = `Mihai ${MARK}`;

test.describe("TC-ASSOC-09 — Două persoane corelate, citite la fel din ambele capete", () => {
  test("legătura persoană–persoană, fără rol, se vede la fel din ambele capete", async ({ page }) => {
    // Room for the `finally` (see the TC-ASSOC-01 spec).
    test.slow();
    await removeLeftovers(page.request, MARK);
    const anaId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ana" });
    const mihaiId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Mihai" });

    try {
      // Step 2 — Ana's „Persoane" (#37.27, „Asocieri" before): empty, „Asociază", „Dezasociază".
      await page.goto(`/natural-persons/${anaId}`);
      await expect(page.getByRole("heading", { name: ANA })).toBeVisible({ timeout: 30_000 });
      await showTile(page, "Persoane");
      await expect(page.getByText("Nicio persoană corelată")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();

      // Step 3 — „Asociere persoană corelată": „Nume", „Cod", Cod · Nume · Tip, the hint, „Tip relație" empty.
      await page.getByRole("button", { name: "Asociază", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${anaId}/associate-person$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere persoană corelată" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(ANA).first()).toBeVisible();
      // `exact`: the sidebar's quick search „Nume, cod…" (the TC-ASSOC-01 spec).
      const nameFilter = page.getByPlaceholder("Nume…", { exact: true });
      await expect(page.getByPlaceholder("Cod…", { exact: true })).toBeVisible();
      for (const col of ["Cod", "Nume", "Tip"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      await expect(page.getByText("Selectați cel puțin o persoană")).toBeVisible();
      // Slice #37.27 (FU-221): „Tip relație" offers the family roles, and is left empty.
      const roleSelect = page.getByLabel("Tip relație", { exact: true });
      await expect(roleSelect).toBeVisible();
      for (const role of ["Soț", "Soție", "Părinte", "Fiu", "Fiică", "Frate", "Soră"]) {
        await expect(roleSelect.locator("option", { hasText: new RegExp(`^${role}$`) })).toHaveCount(1);
      }
      await expect(roleSelect).toHaveValue("");
      await expect(page.getByText(/Niciun rol nu este bifat/)).toHaveCount(0);

      // Step 4 — tick Mihai; the hint goes.
      await nameFilter.fill(MARK);
      await expect(page.getByRole("row").filter({ hasText: MIHAI })).toHaveCount(1, { timeout: 15_000 });
      await page.getByRole("checkbox", { name: MIHAI }).check();
      await expect(page.getByText("Selectați cel puțin o persoană")).toHaveCount(0);

      // Step 5 — back on Ana's „Persoane" (`?tab=related`): Mihai and „—". Slice #37.27:
      // the tile shows the name, the relationship and the buttons — no „Tip" (Fizică / Juridică).
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${anaId}\\?tab=related$`), { timeout: 30_000 });
      const onAna = page.getByRole("row").filter({ hasText: MIHAI });
      await expect(onAna).toHaveCount(1, { timeout: 15_000 });
      await expect(onAna.getByRole("cell", { name: "—", exact: true })).toHaveCount(1);
      await expect(onAna.getByRole("link", { name: "Vizualizare" })).toBeVisible();
      const table = page.getByRole("table").filter({ has: onAna });
      for (const col of ["Nume", "Tip relație"]) {
        await expect(table.getByText(col, { exact: true })).toBeVisible();
      }
      await expect(table.getByRole("columnheader", { name: "Tip", exact: true })).toHaveCount(0);

      // Step 6 — the other end: Mihai's „Persoane" reads Ana, the same way.
      await page.goto(`/natural-persons/${mihaiId}`);
      await expect(page.getByRole("heading", { name: MIHAI })).toBeVisible({ timeout: 30_000 });
      await showTile(page, "Persoane");
      const onMihai = page.getByRole("row").filter({ hasText: ANA });
      await expect(onMihai).toHaveCount(1, { timeout: 30_000 });
      await expect(onMihai.getByRole("cell", { name: "—", exact: true })).toHaveCount(1);

      // ── At the end — radio, „Dezasociază" ────────────────────────────────
      await page.getByRole("radio", { name: ANA }).check();
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Nicio persoană corelată")).toBeVisible({ timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "person", mihaiId);
      await removeRecord(page.request, "person", anaId);
    }
  });
});
