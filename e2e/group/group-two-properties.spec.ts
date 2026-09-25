/**
 * Case:   TC-GRP-01 — Grup cu două proprietăți
 * Source: docs/testing/cases/TC-GRP-01.md, „Last green" 2026-09-25
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * ⚠️ **A GROUP IS SHARED STATE — EVERY USER'S GROUP PICKERS LIST IT.** So the
 * case's own cleanup („Șterge" → „Șterge" on „Grupuri") runs at the end, and
 * the `finally` removes any group whose „Descriere" carries this spec's marker
 * through DELETE /api/groups/[id] — the route that button calls — even when an
 * assertion failed first (`removeGroupLeftovers`, e2e/helpers/records.ts).
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The case's prerequisites are TC-PROP-01's and TC-PROP-03's properties.
 *     Here they are this spec's own, created through the POST route the
 *     „Adaugă" form calls: „TC-E2E-GRP-01 Teren de test" and „TC-E2E-GRP-01
 *     Teren din fisier". So step 5 types `TC-E2E-GRP-01` where the case types
 *     `TC-PROP`, and the two names sort in the case's order, 01 then 02.
 *   - „Descriere" is `TC-E2E-GRP-01 Grup de test`, 26 characters, so step 4's
 *     counter reads „26/500 caractere" where the case's reads „22/500".
 *   - The add-group form's „Descriere" has no accessible name (its <label> is
 *     not tied to the <textarea>), so it is found inside the form headed
 *     „Adaugă grup nou". Noted in the #36.18 handover, not changed here.
 */

import { test, expect } from "@playwright/test";
import {
  E2E_MARKER,
  createProperty,
  removeGroupLeftovers,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";
import { sidebar } from "../helpers/sidebar";

const MARK = `${E2E_MARKER}GRP-01`;
const DESCRIPTION = `${MARK} Grup de test`;
const FIRST = `${MARK} Teren de test`;
const SECOND = `${MARK} Teren din fisier`;

test.describe("TC-GRP-01 — Grup cu două proprietăți", () => {
  test("grup nou, două proprietăți salvate în el, găsite după cod; apoi ștergere", async ({ page }) => {
    // Room for the `finally`, which must run: a group is everyone's.
    test.slow();
    await removeGroupLeftovers(page.request, MARK);
    await removeLeftovers(page.request, MARK);
    const firstId = await createProperty(page.request, { nickname: FIRST });
    const secondId = await createProperty(page.request, { nickname: SECOND });

    try {
      // Step 1 — „Admin-Configurare" → „Grupuri".
      await page.goto("/");
      const nav = sidebar(page);
      const groupsLink = nav.getByRole("link", { name: "Grupuri", exact: true });
      if (!(await groupsLink.isVisible())) {
        await nav.getByRole("button", { name: "Admin-Configurare" }).click();
      }
      await groupsLink.click();
      await expect(page).toHaveURL(/\/admin\/groups$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Grupuri", exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Ce este un Grup?")).toBeVisible();
      const count = page.getByText(/^\d+ grupuri$/);
      await expect(count).toBeVisible({ timeout: 15_000 });
      const before = Number((await count.textContent())?.match(/\d+/)?.[0]);
      for (const col of ["COD", "DESCRIERE"]) {
        await expect(page.getByRole("columnheader", { name: col }).first()).toBeVisible();
      }

      // Step 2 — „+ Adaugă": the inline form, „Țintă" already „Proprietate".
      await page.getByRole("button", { name: "+ Adaugă" }).click();
      const form = page.getByRole("heading", { name: "Adaugă grup nou" }).locator("..");
      await expect(form).toBeVisible();
      await expect(form.getByRole("combobox").locator("option:checked")).toHaveText("Proprietate");

      // Step 3 — „Descriere", „Salvează": stays on the list, a new row „(0)", N+1.
      await form.locator("textarea").fill(DESCRIPTION);
      await form.getByRole("button", { name: "Salvează", exact: true }).click();
      const row = page.getByRole("row").filter({ hasText: DESCRIPTION });
      await expect(row).toHaveCount(1, { timeout: 15_000 });
      await expect(row).toContainText(/GRP-\d+/);
      await expect(row).toContainText("(0)");
      await expect(row).toContainText("Proprietate");
      await expect(page.getByText(`${before + 1} grupuri`, { exact: true })).toBeVisible();
      const code = (await row.textContent())?.match(/GRP-\d+/)?.[0] ?? "";

      // Step 4 — „Editează": „Grup GRP-0nn", the counter, the two panels.
      await row.getByRole("link", { name: "Editează" }).click();
      await expect(page).toHaveURL(/\/admin\/groups\/[0-9a-f-]+$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: `Grup ${code}` })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(`${DESCRIPTION.length}/500 caractere`)).toBeVisible();
      // Each panel is a <section> with no accessible name (group-editor.tsx),
      // so it is found by the title it shows, not by role.
      const available = page.locator("section").filter({ has: page.getByText("Disponibile", { exact: true }) });
      const inGroup = page.locator("section").filter({ has: page.getByText("În grup", { exact: true }) });
      await expect(inGroup.getByText("Niciun element în acest grup încă")).toBeVisible();

      // Step 5 — „Caută…" over „Disponibile": two rows, by nickname only.
      await available.getByPlaceholder("Caută…").fill(MARK);
      await expect(available.getByRole("checkbox")).toHaveCount(2, { timeout: 15_000 });

      // Step 6 — tick both, „Adaugă în grup (2)": „[nou]" each, „Modificări nesalvate".
      await available.getByRole("checkbox", { name: FIRST }).check();
      await available.getByRole("checkbox", { name: SECOND }).check();
      await page.getByRole("button", { name: "Adaugă în grup (2)" }).click();
      for (const name of [FIRST, SECOND]) {
        await expect(inGroup.getByRole("listitem").filter({ hasText: name })).toContainText("[nou]");
      }
      await expect(page.getByText("Modificări nesalvate")).toBeVisible();

      // Step 7 — „Salvează grupul": „[01]" and „[02]"; the unsaved note goes.
      await page.getByRole("button", { name: "Salvează grupul" }).click();
      await expect(inGroup.getByRole("listitem").filter({ hasText: FIRST })).toContainText("[01]", { timeout: 15_000 });
      await expect(inGroup.getByRole("listitem").filter({ hasText: SECOND })).toContainText("[02]");
      await expect(page.getByText("Modificări nesalvate")).toHaveCount(0);

      // Step 8 — back on „Grupuri": the row reads „(2)".
      await page.goto("/admin/groups");
      await expect(page.getByRole("row").filter({ hasText: DESCRIPTION })).toContainText("(2)", { timeout: 30_000 });

      // Step 9 — Căutare globală, „Cod grup": „2 rezultate", positions 01 and 02.
      await page.goto("/admin/global-search");
      await page.getByPlaceholder("ex. GRP-001").fill(code);
      await page.getByRole("button", { name: "Caută", exact: true }).click();
      await expect(page.getByText("2 rezultate", { exact: true })).toBeVisible({ timeout: 30_000 });
      const hits = page.locator("tbody tr");
      await expect(hits).toHaveCount(2);
      await expect(hits.filter({ hasText: FIRST })).toContainText(new RegExp(`${code}\\s*01`));
      await expect(hits.filter({ hasText: SECOND })).toContainText(new RegExp(`${code}\\s*02`));

      // ── At the end — „Șterge" on „Grupuri", answered „Șterge" ────────────
      await page.goto("/admin/groups");
      const toDelete = page.getByRole("row").filter({ hasText: DESCRIPTION });
      await toDelete.getByRole("button", { name: "Șterge", exact: true }).click({ timeout: 30_000 });
      const confirm = page.getByRole("alertdialog");
      await expect(confirm).toContainText("Ștergeți acest grup? Această acțiune nu poate fi anulată.");
      await expect(confirm.getByRole("button", { name: "Anulează" })).toBeVisible();
      await confirm.getByRole("button", { name: "Șterge", exact: true }).click();
      await expect(page.getByRole("row").filter({ hasText: DESCRIPTION })).toHaveCount(0, { timeout: 15_000 });
      await expect(page.getByText(`${before} grupuri`, { exact: true })).toBeVisible();
    } finally {
      await removeGroupLeftovers(page.request, MARK);
      await removeRecord(page.request, "property", secondId);
      await removeRecord(page.request, "property", firstId);
    }
  });
});
