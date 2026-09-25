/**
 * Case:   TC-PROP-03 — Proprietate creată dintr-un fișier cu coordonate
 * Source: docs/testing/cases/TC-PROP-03.md, „Last green" 2026-09-25
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * ⚠️ **NO REAL DATA INTO GIT — THE COORDINATE FILE IS SYNTHETIC.** The hand run
 * reads `08.tc.coord.file`, cut from a real parcel's folder. This spec reads
 * `e2e/fixtures/TC-E2E-PROP-03 Teren din fisier.txt`, four corners made for the
 * purpose (index 16–19, tab-separated, no header, like the original), through
 * `setInputFiles` on the same `sr-only` input the hand run's `file_upload`
 * uses — TC-DOC-01's neutral image is the precedent. So step 6 reads this
 * file's corners and area — 600.00 m², measured by the shoelace over the four
 * corners, the same planar sum that gives the original's 611.87 — where the
 * case reads the original's.
 *
 * Other divergences from the hand run, each for a reason the case cannot have:
 *   - The screen writes the file name into „Poreclă", so the fixture's NAME
 *     carries the TC-E2E- marker (e2e/helpers/records.ts): the row reads
 *     `TC-E2E-PROP-03 Teren din fisier`, and step 7 searches that.
 *   - The case leaves its property for TC-GRP-01. A spec may not, so the
 *     case's own cleanup — „Șterge", „Da" — runs at the end, and a `finally`
 *     removes the row through the same DELETE route if the test stopped before.
 *   - Clicks on the Proprietăți LIST are `{ force: true }`, for the reason the
 *     TC-PROP-01 spec gives (FU-096).
 */

import path from "path";
import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, removeLeftovers, removeRecord } from "../helpers/records";
import { openFromSidebar } from "../helpers/sidebar";

const MARK = `${E2E_MARKER}PROP-03`;
const NICKNAME = `${MARK} Teren din fisier`;
const FIXTURE_NAME = `${NICKNAME}.txt`;
const FIXTURE = path.join(__dirname, "../fixtures", FIXTURE_NAME);
/** The fixture's corners in file order: NR. ORIG., NORD, EST. */
const CORNERS: ReadonlyArray<readonly [string, string, string]> = [
  ["16", "318520.00", "573010.00"],
  ["17", "318500.00", "573000.00"],
  ["18", "318490.00", "573025.00"],
  ["19", "318512.00", "573034.00"],
];

async function readTotal(page: Page): Promise<number> {
  const text = await page.getByText(/^Se afișează \d+ din \d+$/).textContent();
  const m = /din (\d+)/.exec(text ?? "");
  if (!m) throw new Error(`Unexpected count text: "${text}"`);
  return Number(m[1]);
}

test.describe("TC-PROP-03 — Proprietate creată dintr-un fișier cu coordonate", () => {
  test("import din fișier .txt: colțurile, suprafața, porecla, proveniența; apoi ștergere", async ({ page }) => {
    // Room for the `finally`; the property screens compile slowly under `next dev`.
    test.slow();
    await removeLeftovers(page.request, MARK);

    let propertyId: string | undefined;
    try {
      // Step 1 — „Proprietăți — Listă", the count.
      await page.goto("/");
      await openFromSidebar(page, "Proprietăți — Listă");
      await expect(page.getByRole("heading", { name: "Proprietăți", exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/^Se afișează \d+ din \d+$/)).toBeVisible({ timeout: 15_000 });
      const before = await readTotal(page);

      // Step 2 — „Adaugă proprietate": four ways in; „Din fișier text" with its line and warning.
      await page.getByRole("button", { name: "Adaugă proprietate" }).click({ force: true });
      const dialog = page.getByRole("dialog", { name: "Adaugă Proprietate" });
      await expect(dialog).toBeVisible();
      const fromText = dialog.getByRole("button", { name: /^Din fișier text/ });
      await expect(fromText).toContainText("Încărcați un fișier .txt cu coloane index, X (Northing), Y (Easting)");
      await expect(fromText).toContainText("Fără tarla și fără parcelă — proprietatea nu va avea identitate cadastrală.");

      // Step 3 — „Din fișier text": the drop zone, the hint, „Înapoi" / „Importă".
      await fromText.click();
      await expect(dialog.getByText("Încarcă fișier cu coordonate")).toBeVisible();
      await expect(dialog.getByText("Selectați fișierul cu coordonate")).toBeVisible();
      await expect(dialog.getByText("Fereastra de fișiere arată doar fișiere .txt.", { exact: false })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Înapoi" })).toBeVisible();
      const importBtn = dialog.getByRole("button", { name: "Importă" });
      await expect(importBtn).toBeVisible();

      // Step 4 — the file onto the hidden input; the drop zone is NOT pressed.
      await dialog.locator('input[type="file"]').setInputFiles(FIXTURE);
      await expect(dialog.getByText(FIXTURE_NAME)).toBeVisible();

      // Step 5 — „Importă": success, the longer warning, „Închide"; behind it the new row.
      await importBtn.click();
      await expect(dialog.getByText("Proprietatea a fost importată cu succes.")).toBeVisible({ timeout: 30_000 });
      await expect(
        dialog.getByText("Această proprietate nu are nici tarla, nici parcelă, deci nu are identitate cadastrală:", { exact: false }),
      ).toBeVisible();
      const close = dialog.getByRole("button", { name: "Închide" });
      await expect(close).toBeVisible();

      // Step 6 — „Închide", then „Deschide" on the new row: „v 0", the area, four corners.
      await close.click();
      await expect(dialog).toHaveCount(0);
      const top = page.getByRole("row").nth(1);
      await expect(top).toContainText(NICKNAME, { timeout: 15_000 });
      await expect(top).toContainText("Nou!");
      await expect(page.getByText(new RegExp(`^Se afișează \\d+ din ${before + 1}$`))).toBeVisible();
      const href = await top.getByRole("link", { name: "Deschide" }).getAttribute("href");
      propertyId = href?.split("/").pop();
      await top.getByRole("link", { name: "Deschide" }).click({ force: true });
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: NICKNAME })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("v 0", { exact: true }).first()).toBeAttached({ timeout: 30_000 });
      await expect(page.getByRole("group", { name: "Suprafață calculată (m²)" })).toContainText("600.00", { timeout: 30_000 });
      await expect(page.getByText("PUNCTE DE CONTUR").first()).toBeVisible();
      for (const [i, [orig, north, east]] of CORNERS.entries()) {
        const row = page.getByRole("row").filter({ hasText: north }).filter({ hasText: east });
        await expect(row).toHaveCount(1);
        await expect(row.getByRole("cell", { name: String(i + 1), exact: true })).toHaveCount(1);
        await expect(row.getByRole("cell", { name: orig, exact: true })).toHaveCount(1);
      }

      // Step 7 — Căutare globală: one row, `PROP…`, „Fișier de coordonate (.txt)".
      await page.goto(`/admin/global-search?search=${encodeURIComponent(MARK)}`);
      await expect(page.getByText("1 rezultat", { exact: true })).toBeVisible({ timeout: 30_000 });
      const hit = page.locator("tbody tr");
      await expect(hit).toHaveCount(1);
      await expect(hit).toContainText(/PROP\d+/);
      await expect(hit).toContainText("Fișier de coordonate (.txt)");

      // ── At the end — the case's cleanup, through the UI ──────────────────
      await page.goto(`/properties/${propertyId}`);
      await expect(page.getByRole("heading", { name: NICKNAME })).toBeVisible({ timeout: 30_000 });
      // `.last()`: each corner row carries its own „Șterge", and the form's is
      // the one at the very bottom, below the map (TC-PROP-01's step 10).
      await page.getByRole("button", { name: "Șterge", exact: true }).last().click();
      const confirm = page.getByRole("dialog", { name: "Ștergeți proprietatea?" });
      await confirm.getByRole("button", { name: "Da", exact: true }).click();
      await expect(page).toHaveURL(/\/properties$/, { timeout: 30_000 });
      await expect(page.getByRole("row").filter({ hasText: NICKNAME })).toHaveCount(0);
    } finally {
      if (propertyId) await removeRecord(page.request, "property", propertyId);
    }
  });
});
