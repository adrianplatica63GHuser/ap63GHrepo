/**
 * Case:   TC-PROP-01 — Proprietate creată manual, vizibilă în listă
 * Source: docs/testing/cases/TC-PROP-01.md, „Last green" 2026-09-22
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - „Poreclă" is `TC-E2E-PROP-01 Teren de test`, not `TC-PROP-01 Teren de
 *     test` — a spec's rows carry the TC-E2E- marker (e2e/helpers/records.ts).
 *   - The case leaves its property for TC-PROP-02 and TC-ASSOC-02. A spec may
 *     not: it runs on every `npm run e2e`. So the case's own cleanup — open it,
 *     „Șterge", „Da" — runs at the end of this test, and a `finally` removes
 *     the row through the same DELETE route if the test stopped before that.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, removeLeftovers, removeRecord } from "../helpers/records";
import { openFromSidebar } from "../helpers/sidebar";

const NICKNAME = `${E2E_MARKER}PROP-01 Teren de test`;

/** „Se afișează N din M" at the foot of the list, as two numbers. */
async function readCount(page: Page): Promise<{ shown: number; total: number }> {
  const text = await page.getByText(/^Se afișează \d+ din \d+$/).textContent();
  const m = /Se afișează (\d+) din (\d+)/.exec(text ?? "");
  if (!m) throw new Error(`Unexpected count text: "${text}"`);
  return { shown: Number(m[1]), total: Number(m[2]) };
}

test.describe("TC-PROP-01 — Proprietate creată manual, vizibilă în listă", () => {
  test("creare manuală, rândul nou apare în listă, apoi ștergere", async ({ page }) => {
    // A run interrupted before its `finally` leaves its row; remove it first,
    // or step 10 would find two.
    await removeLeftovers(page.request, `${E2E_MARKER}PROP-01`);

    let propertyId: string | undefined;
    try {
      // Step 1 — „Proprietăți — Listă" in the left sidebar.
      await page.goto("/");
      await openFromSidebar(page, "Proprietăți — Listă");
      await expect(page.getByRole("heading", { name: "Proprietăți", exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByPlaceholder("caută după cod, poreclă, nr. cadastru, carte funciară, tarla sau parcelă"),
      ).toBeVisible();
      await expect(page.getByText("Importanță:")).toBeVisible();
      await expect(page.getByText("Relevanță:")).toBeVisible();
      await expect(page.getByRole("button", { name: "Câmpuri afișate" })).toBeVisible();
      // Headers are rendered upper-case by CSS; role-name matching ignores case.
      for (const col of ["COD", "PORECLĂ", "LOCALITATE", "TARLA/SOLĂ", "PARCELĂ"]) {
        await expect(page.getByRole("columnheader", { name: col })).toBeVisible();
      }

      // Step 2 — note the count.
      const before = await readCount(page);

      // Step 3 — „Adaugă proprietate" opens a dialog of four ways in.
      await page.getByRole("button", { name: "Adaugă proprietate" }).click();
      const chooser = page.getByRole("dialog", { name: "Adaugă Proprietate" });
      await expect(chooser).toBeVisible();
      await expect(chooser.getByText("Introducere manuală")).toBeVisible();
      await expect(chooser.getByText("Din imagine scanată")).toBeVisible();
      await expect(chooser.getByText("Din fișier text")).toBeVisible();
      await expect(chooser.getByText("Din folder text")).toBeVisible();

      // Step 4 — „Introducere manuală" („Completați detaliile proprietății manual").
      await chooser.getByRole("link", { name: "Introducere manuală" }).click();
      await expect(page).toHaveURL(/\/properties\/new$/);
      await expect(page.getByRole("heading", { name: "Proprietate nouă" })).toBeVisible({ timeout: 30_000 });
      for (const section of ["DATE CADASTRALE", "PUNCTE DE CONTUR", "ADRESĂ"]) {
        // Upper-case on screen by CSS; non-exact text matching ignores case.
        await expect(page.getByText(section).first()).toBeVisible();
      }

      // Step 5 — „Poreclă".
      await page.getByLabel(/^Poreclă/).fill(NICKNAME);

      // Step 6 — „Nr. tarla / sola" is a closed list; the case picks `40`.
      await page.getByLabel(/^Nr\. tarla \/ sola/).selectOption({ label: "40" });

      // Step 7 — „Nr. parcelă", free text.
      await page.getByLabel(/^Nr\. parcelă/).fill("TC01");

      // Step 8 — „Suprafață oficială (m²)".
      await page.getByLabel(/^Suprafață oficială \(m²\)/).fill("1000");

      // Step 9 — „Salvează", at the bottom below the map; back to the LIST.
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page).toHaveURL(/\/properties$/, { timeout: 30_000 });

      // Step 10 — at the top: badged „Nou!", with the nickname, `40` and `TC01`.
      const top = page.getByRole("row").nth(1);
      await expect(top).toContainText(NICKNAME, { timeout: 15_000 });
      await expect(top).toContainText("Nou!");
      await expect(top).toContainText("40");
      await expect(top).toContainText("TC01");
      const href = await top.getByRole("link", { name: "Deschide" }).getAttribute("href");
      propertyId = href?.split("/").pop();

      // Step 11 — „Se afișează N+1 din N+1". The list pages at 15, so the
      // first number equals the second only while the list fits on one page —
      // the case's own premise on this database. Past that, the total is what
      // moves, and the spec says so rather than fail on a paging detail.
      if (before.shown === before.total && before.total < 15) {
        await expect(page.getByText(`Se afișează ${before.total + 1} din ${before.total + 1}`)).toBeVisible();
      } else {
        await expect(page.getByText(new RegExp(`^Se afișează \\d+ din ${before.total + 1}$`))).toBeVisible();
      }

      // ── At the end — the case's cleanup, through the UI ──────────────────
      await top.getByRole("link", { name: "Deschide" }).click();
      await page.getByRole("button", { name: "Șterge", exact: true }).click();
      const confirm = page.getByRole("dialog", { name: "Ștergeți proprietatea?" });
      await expect(confirm.getByRole("button", { name: "Nu", exact: true })).toBeVisible();
      await confirm.getByRole("button", { name: "Da", exact: true }).click();
      await expect(page).toHaveURL(/\/properties$/, { timeout: 30_000 });
      await expect(page.getByRole("row").filter({ hasText: NICKNAME })).toHaveCount(0);
    } finally {
      if (propertyId) await removeRecord(page.request, "property", propertyId);
    }
  });
});
