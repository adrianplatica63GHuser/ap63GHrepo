/**
 * Case:   TC-DOC-21 — Căutare în „Tip document”: se tastează o parte din nume, fără diacritice, și rămân doar tipurile potrivite
 * Source: docs/testing/cases/TC-DOC-21.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from a hand run, each for a reason the case cannot have:
 *   - The documents carry `TC-E2E-DOC-21` (records.ts).
 *   - A tick reloads the address, so the dropdown is opened again whenever it is not showing.
 */

import { test, expect } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-21`;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

test.describe("TC-DOC-21 — căutare în „Tip document”", () => {
  test("„mostenitor” lasă doar „Certificat de Moștenitor”; bifat, lista arată doar actul lui; „zzz” — niciunul", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const ids = [
      await createDocumentOfType(page.request, "CERTIFICAT_MOSTENITOR", `${MARK} Certificat`),
      await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} Contract`),
    ];
    try {
      // Step 1 — both documents; the dropdown's search box empty and focused, under „Toate tipurile".
      await page.goto("/documents");
      const main = page.locator("main");
      await main.getByPlaceholder("caută după cod, titlu sau nr. document").fill(MARK);
      await expect(main.getByText(`${MARK} Certificat`)).toBeVisible({ timeout: 30_000 });
      await expect(main.getByText(`${MARK} Contract`)).toBeVisible();
      const typeFilter = main.getByRole("button", { name: /^Tip document:/ });
      const search = main.getByRole("searchbox", { name: "Caută un tip…" });
      const open = async () => {
        if (!(await search.isVisible())) await typeFilter.click();
        await expect(search).toBeVisible();
      };
      await open();
      await expect(search).toBeFocused();
      await expect(search).toHaveValue("");
      const all = main.getByRole("checkbox", { name: "Toate tipurile", exact: true });
      expect((await all.boundingBox())!.y).toBeLessThan((await search.boundingBox())!.y);

      // Step 2 — „Toate tipurile" unticked: „Niciun tip".
      await all.click();
      await expect(typeFilter.locator("[data-type-trigger]")).toHaveText("Niciun tip", { timeout: 30_000 });

      // Step 3 — „mostenitor": only names that contain it.
      await open();
      await search.fill("mostenitor");
      const rows = main.locator("[data-type-search]").locator("xpath=ancestor::div[contains(@class,'absolute')][1]").locator("label");
      await expect.poll(async () => {
        const names = (await rows.allTextContents()).map((t) => t.trim()).filter((t) => t !== "Toate tipurile");
        return { all: names.length > 0 && names.every((n) => fold(n).includes("mostenitor")), cert: names.includes("Certificat de Moștenitor"), cvc: names.includes("Contract de Vânzare") };
      }).toEqual({ all: true, cert: true, cvc: false });

      // Step 4 — „Certificat de Moștenitor" ticked: its name; only its document.
      await main.getByRole("checkbox", { name: "Certificat de Moștenitor", exact: true }).click();
      await expect(typeFilter.locator("[data-type-trigger]")).toHaveText("Certificat de Moștenitor", { timeout: 30_000 });
      await expect(main.getByText(`${MARK} Certificat`)).toBeVisible({ timeout: 30_000 });
      await expect(main.getByText(`${MARK} Contract`)).toHaveCount(0);

      // Step 5 — „zzz": the italic line; the tick unchanged.
      await open();
      await search.fill("zzz");
      const none = main.getByText("Niciun tip nu se potrivește.", { exact: true });
      await expect(none).toBeVisible();
      await expect(none).toHaveCSS("font-style", "italic");
      await expect(typeFilter.locator("[data-type-trigger]")).toHaveText("Certificat de Moștenitor");

      // Step 6 — Esc closes; opened again, the box is empty and every type is back.
      await search.press("Escape");
      await expect(search).toBeHidden();
      await typeFilter.click();
      await expect(search).toHaveValue("");
      await expect(main.getByRole("checkbox", { name: "Contract de Vânzare", exact: true })).toBeVisible();
    } finally {
      for (const id of ids) await removeRecord(page.request, "document", id).catch(() => undefined);
    }
  });
});
