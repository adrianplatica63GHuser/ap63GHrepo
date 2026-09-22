/**
 * Case:   TC-PROP-01 — Proprietate creată manual, vizibilă în listă
 * Source: docs/testing/cases/TC-PROP-01.md, „Last green" 2026-09-22
 *
 * ⚠️ **PARKED — THIS FILE IS NOT RUN, AND THAT IS THE CATALOGUE'S RULE, NOT AN
 * ACCIDENT.** (Slice #36.06) Its first `npm run e2e` showed the case file was
 * wrong: step 1's columns were the driving browser's saved „Câmpuri afișate",
 * not what a fresh browser shows. The case was corrected, which sends it back
 * to `driven`, and a spec may only run for a `confirmed` case. The name
 * `.parked.ts` keeps it out of Playwright's `*.spec.ts` match and out of the
 * coverage guard, and inside `tsc`. It already follows the corrected file.
 * TO PROMOTE AGAIN: drive TC-PROP-01 unchanged once more (→ `confirmed`),
 * `git mv` this back to `property-create.spec.ts`, put the path in the
 * catalogue's `Spec` column, and update the `Source:` date above.
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
 *   - Clicks on the Proprietăți LIST are `{ force: true }`. Measured on the
 *     first run (TC-PROP-02's trace): „Deschide" on that list resolved, was
 *     visible in the screenshot, and Playwright still waited 34 s for it to be
 *     „visible, enabled and stable" until the test timed out — nothing on the
 *     row moves, and the same click on the persons and documents lists went
 *     through at once. Not explained yet; `force` skips only the stability
 *     wait, and the URL assertion after each click still proves it landed.
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
    test.slow(); // the property screens compile slowly under `next dev`; leaves the finally room to run
    // A run interrupted before its `finally` leaves its row; remove it first,
    // or step 11 would find two.
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
      const chooseFields = page.getByRole("button", { name: /^Câmpuri afișate\s*4\/4$/ });
      await expect(chooseFields).toBeVisible();
      // Headers are rendered upper-case by CSS; role-name matching ignores case.
      // A Playwright browser has never changed „Câmpuri afișate", so step 1's
      // columns are the defaults the case names.
      for (const col of ["COD", "PORECLĂ", "NR. CADASTRU", "OFICIALĂ (M²)", "LOCALITATE"]) {
        await expect(page.getByRole("columnheader", { name: col })).toBeVisible();
      }

      // Step 2 — „Câmpuri afișate": untick first (four at most), then tick
      // „Tarla/Solă" and „Parcelă"; press outside it.
      await chooseFields.click({ force: true });
      const picker = page.getByText("Selectați până la 4 coloane opționale").locator("..");
      await expect(picker).toBeVisible();
      await picker.getByRole("checkbox", { name: "Nr. cadastru" }).uncheck({ force: true });
      await picker.getByRole("checkbox", { name: "Oficială (m²)" }).uncheck({ force: true });
      await picker.getByRole("checkbox", { name: "Tarla/Solă" }).check({ force: true });
      await picker.getByRole("checkbox", { name: "Parcelă" }).check({ force: true });
      await page.getByRole("heading", { name: "Proprietăți", exact: true }).click({ force: true });
      await expect(picker).toHaveCount(0);
      for (const col of ["COD", "PORECLĂ", "LOCALITATE", "TARLA/SOLĂ", "PARCELĂ"]) {
        await expect(page.getByRole("columnheader", { name: col })).toBeVisible();
      }

      // Step 3 — note the count.
      const before = await readCount(page);

      // Step 4 — „Adaugă proprietate" opens a dialog of four ways in.
      await page.getByRole("button", { name: "Adaugă proprietate" }).click({ force: true });
      const chooser = page.getByRole("dialog", { name: "Adaugă Proprietate" });
      await expect(chooser).toBeVisible();
      await expect(chooser.getByText("Introducere manuală")).toBeVisible();
      await expect(chooser.getByText("Din imagine scanată")).toBeVisible();
      await expect(chooser.getByText("Din fișier text")).toBeVisible();
      await expect(chooser.getByText("Din folder text")).toBeVisible();

      // Step 5 — „Introducere manuală" („Completați detaliile proprietății manual").
      await chooser.getByRole("link", { name: "Introducere manuală" }).click();
      await expect(page).toHaveURL(/\/properties\/new$/);
      await expect(page.getByRole("heading", { name: "Proprietate nouă" })).toBeVisible({ timeout: 30_000 });
      for (const section of ["DATE CADASTRALE", "PUNCTE DE CONTUR", "ADRESĂ"]) {
        // Upper-case on screen by CSS; non-exact text matching ignores case.
        await expect(page.getByText(section).first()).toBeVisible();
      }

      // Step 6 — „Poreclă".
      await page.getByLabel(/^Poreclă/).fill(NICKNAME);

      // Step 7 — „Nr. tarla / sola" is a closed list; the case picks `40`.
      await page.getByLabel(/^Nr\. tarla \/ sola/).selectOption({ label: "40" });

      // Step 8 — „Nr. parcelă", free text.
      await page.getByLabel(/^Nr\. parcelă/).fill("TC01");

      // Step 9 — „Suprafață oficială (m²)".
      await page.getByLabel(/^Suprafață oficială \(m²\)/).fill("1000");

      // Step 10 — „Salvează", at the bottom below the map; back to the LIST.
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page).toHaveURL(/\/properties$/, { timeout: 30_000 });

      // Step 11 — at the top: badged „Nou!", with the nickname, `40` and `TC01`.
      const top = page.getByRole("row").nth(1);
      await expect(top).toContainText(NICKNAME, { timeout: 15_000 });
      await expect(top).toContainText("Nou!");
      await expect(top).toContainText("40");
      await expect(top).toContainText("TC01");
      const href = await top.getByRole("link", { name: "Deschide" }).getAttribute("href");
      propertyId = href?.split("/").pop();

      // Step 12 — „Se afișează N+1 din N+1". The list pages at 15, so the
      // first number equals the second only while the list fits on one page —
      // the case's own premise on this database. Past that, the total is what
      // moves, and the spec says so rather than fail on a paging detail.
      if (before.shown === before.total && before.total < 15) {
        await expect(page.getByText(`Se afișează ${before.total + 1} din ${before.total + 1}`)).toBeVisible();
      } else {
        await expect(page.getByText(new RegExp(`^Se afișează \\d+ din ${before.total + 1}$`))).toBeVisible();
      }

      // ── At the end — the case's cleanup, through the UI ──────────────────
      await top.getByRole("link", { name: "Deschide" }).click({ force: true });
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}$`), { timeout: 30_000 });
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
