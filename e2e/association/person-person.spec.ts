/**
 * Case:   TC-ASSOC-09 — Două persoane corelate, citite corect din ambele capete
 * Source: docs/testing/cases/TC-ASSOC-09.md, „Last green" 2026-09-30
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Slice #37.28: the case finally has the directional role it was written for.
 * From Ana's screen Mihai is ticked as „Părinte" — Mihai is Ana's father — so
 * Ana's tile reads „Mihai — Părinte" and Mihai's reads „Ana — Fiică", the
 * converse of „Părinte" for a woman (migration_088). Until #37.28 both ends
 * read the same word, which is why the case used to pick no role at all.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - Step 1's two people are this spec's own, created through the POST route
 *     the „Adaugă persoană" form calls — „Ana TC-E2E-ASSOC-09" (Feminin) and
 *     „Mihai TC-E2E-ASSOC-09" (Masculin). Driving that form is TC-PERS-01's
 *     spec's job.
 *   - Step 4 first types `TC-E2E-ASSOC-09` into „Nume": the case's database
 *     has almost no people, a spec's may have a page of them.
 *   - Step 6 opens Mihai by his address.
 *   - Both are removed in `finally` through DELETE /api/people/[id], after the
 *     case's own cleanup (radio, „Dezasociază") has run.
 *   - Slice #37.17: a Natural Person has no tab row; the person's „Persoane"
 *     is a tile, ticked with `showTile` (e2e/helpers/tiles.ts) where the hand
 *     run clicks the tile's checkbox.
 *   - Slice #37.67: the person's „Persoane", „Proprietăți" and „Acte" are one tile, „Corelate",
 *     one line a row — „Nume (Rol)" — with „Asociază persoană" (the case's steps as corrected on
 *     2026-10-03).
 */

import { test, expect } from "@playwright/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { expectOneLine, lineRow, showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}ASSOC-09`;
const ANA = `Ana ${MARK}`;
const MIHAI = `Mihai ${MARK}`;

test.describe("TC-ASSOC-09 — Două persoane corelate, citite corect din ambele capete", () => {
  test("părinte și copil: fiecare capăt citește rolul celuilalt", async ({ page }) => {
    // Room for the `finally` (see the TC-ASSOC-01 spec).
    test.slow();
    await removeLeftovers(page.request, MARK);
    const anaId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ana", gender: "FEMALE" });
    const mihaiId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Mihai", gender: "MALE" });

    try {
      // Step 2 — Ana's „Corelate": empty, „Asociază persoană", „Dezasociază".
      await page.goto(`/natural-persons/${anaId}`);
      await expect(page.getByRole("heading", { name: ANA })).toBeVisible({ timeout: 30_000 });
      const related = await showTile(page, "Legături");
      await expect(related.getByText("Nimic corelat încă.")).toBeVisible({ timeout: 30_000 });
      await expect(related.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();

      // Step 3 — „Asociere persoană corelată": „Nume", „Cod", Cod · Nume · Tip, the hint,
      // „Tip relație" with the family roles and the sentence saying whose role it is.
      await related.getByRole("button", { name: "Asociază persoană", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${anaId}/associate-person$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere persoană corelată" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(ANA).first()).toBeVisible();
      // `exact`: the sidebar's quick search „Nume, cod…" (the TC-ASSOC-01 spec).
      const nameFilter = page.getByPlaceholder("Nume…", { exact: true });
      await expect(page.getByPlaceholder("Cod…", { exact: true })).toBeVisible();
      for (const col of ["Nume", "Tip"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      await expect(page.getByText("Selectați cel puțin o persoană")).toBeVisible();
      const roleSelect = page.getByLabel("Tip relație", { exact: true });
      await expect(roleSelect).toBeVisible();
      for (const role of ["Soț", "Soție", "Părinte", "Fiu", "Fiică", "Frate", "Soră"]) {
        await expect(roleSelect.locator("option", { hasText: new RegExp(`^${role}$`) })).toHaveCount(1);
      }
      await expect(page.getByText(`Rolul pe care persoana bifată îl are față de ${ANA}.`)).toBeVisible();

      // Step 4 — tick Mihai, choose „Părinte": the hint goes.
      await nameFilter.fill(MARK);
      await expect(page.getByRole("row").filter({ hasText: MIHAI })).toHaveCount(1, { timeout: 15_000 });
      await page.getByRole("checkbox", { name: MIHAI }).check();
      await expect(page.getByText("Selectați cel puțin o persoană")).toHaveCount(0);
      await roleSelect.selectOption({ label: "Părinte" });

      // Step 5 — back on Ana's „Corelate" (`?tab=related`): one line, „Mihai … (Părinte)".
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${anaId}\\?tab=related$`), { timeout: 30_000 });
      const onAna = lineRow(page.getByRole("region", { name: "Legături", exact: true }), MIHAI);
      await expect(onAna).toHaveCount(1, { timeout: 15_000 });
      await expect(onAna.locator("[data-row-content]")).toHaveText(`${MIHAI} (Părinte)`);
      await expect(onAna.getByRole("link", { name: "Vizualizare" })).toBeVisible();
      await expectOneLine(onAna);
      await expect(page.getByRole("columnheader")).toHaveCount(0);

      // Step 6 — the other end: Mihai's „Corelate" reads Ana as „Fiică".
      await page.goto(`/natural-persons/${mihaiId}`);
      await expect(page.getByRole("heading", { name: MIHAI })).toBeVisible({ timeout: 30_000 });
      const onMihai = lineRow(await showTile(page, "Legături"), ANA);
      await expect(onMihai).toHaveCount(1, { timeout: 30_000 });
      await expect(onMihai.locator("[data-row-content]")).toHaveText(`${ANA} (Fiică)`);
      await expect(onMihai).not.toContainText("Părinte");

      // ── At the end — radio, „Dezasociază" ────────────────────────────────
      await page.getByRole("radio", { name: ANA }).check();
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Nimic corelat încă.")).toBeVisible({ timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "person", mihaiId);
      await removeRecord(page.request, "person", anaId);
    }
  });
});
