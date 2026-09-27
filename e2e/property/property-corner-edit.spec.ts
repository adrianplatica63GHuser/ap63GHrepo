/**
 * Case:   TC-PROP-04 — Un colț editat în „Puncte de contur”, văzut după salvare
 * Source: docs/testing/cases/TC-PROP-04.md, „Last green" 2026-09-26
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * ⚠️ **THE CORNERS ARE THE CASE'S OWN FILE, READ AT RUN TIME, NOT A FIXTURE.**
 * The case asserts the application's figures — 611.87 m², and 614.42 m² after
 * the edit — and those come from the file's THREE decimals; a figure worked
 * out from the two the screen shows would be 611.98 and 614.51 (the case file
 * says so). The synthetic corners TC-PROP-03's spec uses give neither number.
 * So this spec reads `C:\dev\TEST.DATA\Test.Claude\08.tc.coord.file\TC-PROP-03
 * Teren din fisier.txt` — outside git, beside the repo, where the test runner
 * finds it — and uploads a COPY named `TC-E2E-PROP-04 Teren din fisier.txt`
 * from the temp folder, so the property it creates carries this spec's marker
 * and nothing of a real parcel enters `e2e/fixtures/`. Where the folder is
 * absent the test skips and says why.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The case's precondition is TC-PROP-03's property. Here it is this spec's
 *     own, made the TC-PROP-03 way from the copy above, and deleted at the end.
 *   - Clicks on a corner are scoped to its row by „Nr. orig." (the case file's
 *     note: both arrows, „Editează" and „Șterge" sit on every row).
 */

import fs from "fs";
import os from "os";
import path from "path";
import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}PROP-04`;
const NICKNAME = `${MARK} Teren din fisier`;
const SOURCE = path.resolve(
  __dirname,
  "../../../TEST.DATA/Test.Claude/08.tc.coord.file/TC-PROP-03 Teren din fisier.txt",
);

/** The corner row whose „Nr. orig." is `orig`, while it is not being edited. */
function cornerRow(page: Page, orig: string) {
  return page.getByRole("row").filter({ has: page.getByRole("cell", { name: orig, exact: true }) });
}

const computedArea = (page: Page) => page.getByRole("group", { name: "Suprafață calculată (m²)" });

test.describe("TC-PROP-04 — Un colț editat în „Puncte de contur”, văzut după salvare", () => {
  test("colțul 18 mutat trei metri spre est: suprafața, versiunea nouă, versiunea veche păstrată", async ({ page }) => {
    test.skip(!fs.existsSync(SOURCE), `The case's data file is not here: ${SOURCE}`);
    test.slow();
    await removeLeftovers(page.request, MARK);

    const upload = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tc-e2e-prop-04-")), `${NICKNAME}.txt`);
    fs.copyFileSync(SOURCE, upload);

    let propertyId: string | undefined;
    try {
      // The precondition, the TC-PROP-03 way: „Adaugă proprietate" → „Din fișier text" → „Importă".
      await page.goto("/properties");
      await page.getByRole("button", { name: "Adaugă proprietate" }).click({ force: true });
      const dialog = page.getByRole("dialog", { name: "Adaugă Proprietate" });
      await dialog.getByRole("button", { name: /^Din fișier text/ }).click();
      await dialog.locator('input[type="file"]').setInputFiles(upload);
      await dialog.getByRole("button", { name: "Importă" }).click();
      await expect(dialog.getByText("Proprietatea a fost importată cu succes.")).toBeVisible({ timeout: 30_000 });
      await dialog.getByRole("button", { name: "Închide" }).click();
      const top = page.getByRole("row").filter({ hasText: NICKNAME });
      await expect(top).toHaveCount(1, { timeout: 15_000 });
      propertyId = (await top.getByRole("link", { name: "Deschide" }).getAttribute("href"))?.split("/").pop();

      // Step 1 — „v 0", 611.87, „Afișare: DD DMS Stereo 70", Nr. · Nr. orig. · Nord (m) · Est (m),
      // rows 16–19 each with „↑", „↓", „Editează", „Șterge", then „+ Adaugă punct".
      await page.goto(`/properties/${propertyId}`);
      await expect(page.getByRole("heading", { name: NICKNAME })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("v 0", { exact: true }).first()).toBeAttached({ timeout: 30_000 });
      await expect(computedArea(page)).toContainText("611.87", { timeout: 30_000 });
      await expect(page.getByText("Afișare:")).toBeVisible();
      for (const mode of ["DD", "DMS", "Stereo 70"]) {
        await expect(page.getByRole("button", { name: mode, exact: true })).toBeVisible();
      }
      for (const col of ["Nr.", "Nr. orig.", "Nord (m)", "Est (m)"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      for (const orig of ["16", "17", "18", "19"]) {
        const r = cornerRow(page, orig);
        await expect(r).toHaveCount(1);
        for (const b of ["↑", "↓", "Editează", "Șterge"]) {
          await expect(r.getByRole("button", { name: b, exact: true })).toBeVisible();
        }
      }
      await expect(page.getByRole("button", { name: "+ Adaugă punct" })).toBeVisible();

      // Step 2 — „Editează" on row 3 (Nr. orig. 18): two inputs holding its values, „Salvează" / „Anulează".
      const row18 = cornerRow(page, "18");
      await expect(row18).toContainText("318659.52");
      await expect(row18).toContainText("573567.20");
      await row18.getByRole("button", { name: "Editează", exact: true }).click();
      const north = page.getByLabel("Nord (m)", { exact: true });
      const east = page.getByLabel("Est (m)", { exact: true });
      await expect(north).toHaveValue("318659.52");
      await expect(east).toHaveValue("573567.20");
      const editing = page.getByRole("row").filter({ has: east });
      await expect(editing.getByRole("button", { name: "Anulează", exact: true })).toBeVisible();

      // Step 3 — Est `573570.20`, the row's „Salvează": the row, 614.42 at once, „Modificări nesalvate".
      await east.fill("573570.20");
      await editing.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(cornerRow(page, "18")).toContainText("573570.20");
      await expect(cornerRow(page, "18")).toContainText("318659.52");
      await expect(computedArea(page)).toContainText("614.42");
      await expect(page.getByRole("status").filter({ hasText: "Modificări nesalvate" })).toBeVisible();

      // Step 4 — the form's „Salvează": stays, „v 1", „2 versiuni".
      await page.getByRole("button", { name: "Salvează", exact: true }).last().click();
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}$`));
      await expect(page.getByRole("button", { name: "2 versiuni" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("v 1", { exact: true }).first()).toBeAttached();

      // Step 5 — reload: „v 1", 614.42, row 3 still 573570.20.
      await page.reload();
      await expect(page.getByRole("button", { name: "2 versiuni" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("v 1", { exact: true }).first()).toBeAttached();
      await expect(computedArea(page)).toContainText("614.42", { timeout: 30_000 });
      await expect(cornerRow(page, "18")).toContainText("573570.20");

      // Step 6 — „2 versiuni": „v 0", 611.87, row 3 back at 573567.20.
      await page.getByRole("button", { name: "2 versiuni" }).click();
      await expect(page.getByText("v 0", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(computedArea(page)).toContainText("611.87");
      await expect(cornerRow(page, "18")).toContainText("573567.20");

      // ── At the end — made for this run, so deleted: „Șterge", „Da" ───────
      await page.reload();
      await expect(page.getByRole("button", { name: "2 versiuni" })).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: "Șterge", exact: true }).last().click();
      const confirm = page.getByRole("dialog", { name: "Ștergeți proprietatea?" });
      await confirm.getByRole("button", { name: "Da", exact: true }).click();
      await expect(page).toHaveURL(/\/properties$/, { timeout: 30_000 });
    } finally {
      if (propertyId) await removeRecord(page.request, "property", propertyId);
      fs.rmSync(path.dirname(upload), { recursive: true, force: true });
    }
  });
});
