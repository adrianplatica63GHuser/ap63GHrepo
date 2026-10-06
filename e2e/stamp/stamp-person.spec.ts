/**
 * Case:   TC-STAMP-01 — Ștampilă creată, aplicată unei persoane și găsită din ambele capete
 * Source: docs/testing/cases/TC-STAMP-01.md, „Last green" 2026-09-26
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * ⚠️ **A STAMP IS SHARED STATE — EVERY „+ Aplică ștampilă" PICKER LISTS IT.** So
 * the case's own cleanup („Șterge" → „Șterge" on „Ștampile") runs at the end,
 * and the `finally` removes any stamp whose „Descriere scurtă" carries this
 * spec's marker through DELETE /api/stamps/[id] — the route that button calls —
 * even when an assertion failed first (`removeStampLeftovers`). As the case
 * says, each run spends one stamp code; codes are never reused.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The person is made through the POST route „Adaugă persoană" sends
 *     (TC-PERS-01's spec drives that form), and every name carries the
 *     TC-E2E- marker: `Ion TC-E2E-STAMP-01`, `TC-E2E-STAMP-01 Ștampilă de test`
 *     — 32 characters, so step 4's counter reads „32/200 caractere" where the
 *     case's reads „28/200".
 *   - The create form's „Descriere scurtă" and „Note" have labels that are
 *     not tied to their fields, so they are found by position on the page.
 *     Not changed here. (The stamp screen's „Tip element" names its select
 *     since #38.13, and is found by that name.)
 *   - „Elemente disponibile pentru ștampilare" („Disponibile" before #38.13) is
 *     narrowed with its „Caută…" to this spec's person, so the
 *     tick lands on the right row on a database with many people.
 *   - Slice #37.17: a Natural Person has no tab row; the person's „META INFO" (since #37.63 „Conexiuni")
 *     is a tile, ticked with `showTile` (e2e/helpers/tiles.ts) where the hand
 *     run clicks the tile's checkbox.
 */

import { test, expect } from "@playwright/test";
import {
  E2E_MARKER,
  createNaturalPerson,
  removeLeftovers,
  removeRecord,
  removeStampLeftovers,
} from "../helpers/records";
import { sidebar } from "../helpers/sidebar";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}STAMP-01`;
const DESCRIPTION = `${MARK} Ștampilă de test`;
const NOTE = `Creată de cazul de test ${MARK}; se șterge la final.`;
const PERSON = `Ion ${MARK}`;

test.describe("TC-STAMP-01 — Ștampilă creată, aplicată unei persoane și găsită din ambele capete", () => {
  test("ștampilă nouă, aplicată unei persoane, numărată și văzută pe persoană; apoi ștearsă", async ({ page }) => {
    // Room for a first-request compile of the screen it opens (below) and for the `finally`.
    test.setTimeout(240_000);
    await removeStampLeftovers(page.request, MARK);
    await removeLeftovers(page.request, MARK);
    const personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });

    try {
      // Step 2 — „Admin-Configurare" → „Ștampile": the heading, the panel, „+ Creare ștampilă", N.
      await page.goto("/");
      const nav = sidebar(page);
      const stampsLink = nav.getByRole("link", { name: "Ștampile", exact: true });
      if (!(await stampsLink.isVisible())) {
        await nav.getByRole("button", { name: "Admin-Configurare" }).click();
      }
      await stampsLink.click();
      await expect(page).toHaveURL(/\/admin\/stamps$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Ștampile", exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Ce este o Ștampilă?")).toBeVisible();
      const count = page.getByText(/^\d+ ștampile$/);
      await expect(count).toBeVisible({ timeout: 15_000 });
      const before = Number(/^(\d+)/.exec((await count.textContent()) ?? "")?.[1]);
      for (const col of ["Ștampilă", "Elemente"]) {
        await expect(page.getByRole("columnheader", { name: col })).toBeVisible();
      }

      // Step 3 — „+ Creare ștampilă": the inline form.
      await page.getByRole("button", { name: "+ Creare ștampilă" }).first().click();
      await expect(page.getByText("Creare ștampilă", { exact: true })).toBeVisible();
      await expect(page.getByText("0/200 caractere")).toBeVisible();
      await expect(page.getByText("Atribuit automat la salvare")).toBeVisible();
      const shortDescription = page.locator('main input[type="text"][maxlength="200"]');
      const notes = page.locator("main textarea");

      // Step 4 — the description (counter follows), the note, „Salvează": stays on the list,
      // a new first row, count 0, N+1 stamps.
      await shortDescription.fill(DESCRIPTION);
      await expect(page.getByText(`${DESCRIPTION.length}/200 caractere`)).toBeVisible();
      await notes.fill(NOTE);
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/stamps$/);
      await expect(page.getByText(`${before + 1} ștampile`, { exact: true })).toBeVisible({ timeout: 15_000 });
      const first = page.locator("tbody tr").first();
      await expect(first).toContainText(new RegExp(`STMP-[A-Z]{3}\\s*— ${DESCRIPTION}`));
      await expect(first.locator("td").nth(1)).toHaveText("0");

      // Step 5 — „Aplică": the stamp's own screen.
      // Pressed until the screen changes, for up to 90 s: the first runner run
      // (20260927T004011Z-17430) sat 30 s on „Ștampile" after pressing it — a
      // press during the list's re-render, or a first-request compile.
      await expect(async () => {
        if (/\/admin\/stamps\/[0-9a-f-]+$/.test(page.url())) return;
        await first.getByRole("link", { name: "Aplică", exact: true }).click({ timeout: 5_000 });
        await expect(page).toHaveURL(/\/admin\/stamps\/[0-9a-f-]+$/, { timeout: 15_000 });
      }).toPass({ timeout: 90_000 });
      await expect(page.getByRole("heading", { name: new RegExp(`^Aplică ștampila: STMP-[A-Z]{3} - ${DESCRIPTION}$`) }))
        .toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Cod", { exact: true }).first()).toBeVisible();
      // #38.13: the tiles' names; „Tip element" is the tile's title, and names its select.
      await expect(page.getByRole("region", { name: "Descrierea ștampilei", exact: true })).toBeVisible();
      await expect(page.getByText("Tip element", { exact: true })).toBeVisible();
      const targetType = page.getByRole("combobox", { name: "Tip element", exact: true });
      await expect(targetType.locator("option")).toHaveText(["Persoană fizică", "Persoană juridică", "Proprietate", "Document"]);
      await expect(targetType.locator("option:checked")).toHaveText("Persoană fizică");
      await expect(page.getByText("Sunt afișate doar elementele de tipul selectat", { exact: false })).toBeVisible();
      await expect(page.getByRole("region", { name: "Elemente disponibile pentru ștampilare", exact: true })).toBeVisible();
      await expect(page.getByRole("region", { name: "Elemente deja ștampilate", exact: true })).toBeVisible();
      await expect(page.getByText("Niciun element ștampilat încă")).toBeVisible();
      await expect(page.getByRole("button", { name: "Aplică ștampila (0)" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Elimină ștampila (0)" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Salvează ștampilele" })).toBeVisible();

      // Step 6 — tick the person, „Aplică ștampila (1)": it moves across, „Modificări nesalvate".
      await page.getByRole("searchbox", { name: "Caută în elementele disponibile" }).fill(MARK, { timeout: 15_000 });
      await page.getByRole("checkbox", { name: PERSON }).check({ timeout: 15_000 });
      await page.getByRole("button", { name: "Aplică ștampila (1)" }).click();
      await expect(page.getByText("Modificări nesalvate")).toBeVisible();
      await expect(page.getByText("Niciun element ștampilat încă")).toHaveCount(0);

      // Step 7 — „Salvează ștampilele": the banner goes.
      await page.getByRole("button", { name: "Salvează ștampilele" }).click();
      await expect(page.getByText("Modificări nesalvate")).toHaveCount(0, { timeout: 15_000 });

      // Step 8 — back on „Ștampile": „Elemente" reads 1.
      await page.goto("/admin/stamps");
      const row = page.locator("tbody tr").filter({ hasText: DESCRIPTION });
      await expect(row).toHaveCount(1, { timeout: 30_000 });
      await expect(row.locator("td").nth(1)).toHaveText("1");
      const code = /STMP-[A-Z]{3}/.exec((await row.textContent()) ?? "")?.[0] ?? "STMP-";

      // Step 9 — the person's „Conexiuni" (META INFO until #37.63): „Ștampile", „+ Aplică ștampilă", the chip with „×".
      await page.goto(`/natural-persons/${personId}`);
      await expect(page.getByRole("heading", { name: PERSON })).toBeVisible({ timeout: 30_000 });
      await showTile(page, "Conexiuni");
      await expect(page.getByRole("button", { name: "+ Aplică ștampilă" })).toBeVisible();
      await expect(page.getByText(code, { exact: true })).toBeVisible();
      await expect(page.getByText(DESCRIPTION, { exact: true })).toBeVisible();

      // ── At the end — „Șterge" on the row, answered „Șterge"; N again; the chip gone ──
      await page.goto("/admin/stamps");
      const toDelete = page.locator("tbody tr").filter({ hasText: DESCRIPTION });
      await toDelete.getByRole("button", { name: "Șterge", exact: true }).click({ timeout: 30_000 });
      const confirm = page.getByRole("alertdialog");
      await expect(confirm).toContainText(
        "Ștergeți această ștampilă și o eliminați de pe toate elementele? Această acțiune nu poate fi anulată.",
      );
      await expect(confirm.getByRole("button", { name: "Anulează", exact: true })).toBeVisible();
      await confirm.getByRole("button", { name: "Șterge", exact: true }).click();
      await expect(page.getByText(`${before} ștampile`, { exact: true })).toBeVisible({ timeout: 15_000 });
      await page.goto(`/natural-persons/${personId}`);
      await showTile(page, "Conexiuni");
      await expect(page.getByText("Nicio ștampilă aplicată")).toBeVisible({ timeout: 15_000 });
    } finally {
      await removeStampLeftovers(page.request, MARK);
      await removeRecord(page.request, "person", personId);
    }
  });
});
