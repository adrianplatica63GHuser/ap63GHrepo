/**
 * Case:   TC-PROP-15 — „Din fișier text" pe o parcelă care are deja o proprietate
 * Source: docs/testing/cases/TC-PROP-15.md, „Last green" 2026-10-17 (Slice #39.65)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The names carry `TC-E2E-PROP-15` (records.ts). The file is TC-PROP-03's synthetic fixture, set on the input
 *     under this case's name through `setInputFiles` with a buffer, so the drop zone shows this case's file name.
 *   - The tarla is the list's „40", as in TC-PROP-01 and TC-PROP-03; the existing property is made with its id.
 *   - The count is read from the list's API, which is what the foot of the list prints.
 */

import fs from "fs";
import path from "path";
import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}PROP-15`;
const EXISTING = `${MARK} Teren existent`;
const FILE_NAME = `${MARK} Teren din fisier.txt`;
const FIXTURE = path.join(__dirname, "../fixtures", `${E2E_MARKER}PROP-03 Teren din fisier.txt`);

async function total(page: Page): Promise<number> {
  const res = await page.request.get("/api/properties?limit=1");
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { total: number }).total;
}

test.describe("TC-PROP-15 — „Din fișier text” pe o parcelă care are deja o proprietate", () => {
  test("nu se creează alta: mesajul și legătura spre ea", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const tarlaList = (await (await page.request.get("/api/admin/value-lists/tarla")).json()) as { items: { id: string; indicativ: string }[] };
    const tarla40 = tarlaList.items.find((t) => t.indicativ === "40");
    expect(tarla40, "the database has no tarla 40").toBeTruthy();
    const existingId = await createProperty(page.request, { nickname: EXISTING, tarlaId: tarla40!.id, parcela: "TC15" });
    try {
      // Step 1 — „Proprietăți", the count, „Adaugă proprietate", „Din fișier text".
      await page.goto("/properties");
      await expect(page.getByRole("heading", { name: "Proprietăți", exact: true })).toBeVisible({ timeout: 30_000 });
      const before = await total(page);
      await page.getByRole("button", { name: "Adaugă proprietate" }).click({ force: true });
      const dialog = page.getByRole("dialog", { name: "Adaugă Proprietate" });
      await dialog.getByRole("button", { name: /^Din fișier text/ }).click();
      await expect(dialog.getByText("Încarcă fișier cu coordonate")).toBeVisible();

      // Step 2 — the file, 40, TC15, „Importă": the dialog stays on the file and says the parcel has a property.
      await dialog.locator('input[type="file"]').setInputFiles({ name: FILE_NAME, mimeType: "text/plain", buffer: fs.readFileSync(FIXTURE) });
      await dialog.getByRole("combobox", { name: "Nr. tarla / sola" }).selectOption({ label: "40" });
      await dialog.getByRole("textbox", { name: "Nr. parcelă" }).fill("TC15");
      await dialog.getByRole("button", { name: "Importă" }).click();
      const box = dialog.locator("[data-parcel-exists]");
      await expect(box).toBeVisible({ timeout: 30_000 });
      await expect(box).toContainText("Această parcelă are deja o proprietate");
      await expect(box).toContainText("Tarla 40, parcela TC15 aparține deja proprietății de mai jos. Nu s-a creat o proprietate nouă.");
      await expect(dialog.getByText(FILE_NAME)).toBeVisible();
      const open = box.getByRole("link", { name: `Deschide ${EXISTING}` });
      await expect(open).toHaveAttribute("href", `/properties/${existingId}`);

      // Step 3 — the link: the dialog closes, the existing property opens.
      await open.click();
      await expect(page).toHaveURL(new RegExp(`/properties/${existingId}$`), { timeout: 30_000 });
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("heading", { name: EXISTING })).toBeVisible({ timeout: 30_000 });

      // Step 4 — the count unchanged; no property named for the file.
      expect(await total(page)).toBe(before);
      const named = (await (await page.request.get(`/api/properties?q=${encodeURIComponent(MARK)}`)).json()) as { items: { nickname: string }[] };
      expect(named.items.map((i) => i.nickname)).toEqual([EXISTING]);
    } finally {
      await removeRecord(page.request, "property", existingId);
      await removeLeftovers(page.request, MARK);
    }
  });
});
