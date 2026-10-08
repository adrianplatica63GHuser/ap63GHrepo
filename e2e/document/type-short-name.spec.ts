/**
 * Case:   TC-DOC-15 — Lista actelor arată tipul prin denumirea lui scurtă; denumirea întreagă în bulă
 * Source: docs/testing/cases/TC-DOC-15.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The documents carry `TC-E2E-DOC-15` (records.ts), and the list is
 *     searched for it.
 *   - „Încheiere de Intabulare"'s short name is read before the run and put
 *     back after it through the same route the editor's „Salvează" sends, so a
 *     failed step cannot leave it changed.
 *   - Slice #38.39: a document type is edited on its own page, „General" —
 *     „Deschide" on the list's row, not the row's „Editează". What was read off
 *     the list's „Denumire scurtă" cell is read off the API the page saves to.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-15`;
const TYPE = "Încheiere de Intabulare";
const REFUSAL = "Alt tip de document se citește deja cu această denumire scurtă în lista actelor. Alegeți alta — sau lăsați câmpul gol, iar lista va scurta singură denumirea.";

type DocType = { id: string; key: string; name: string; shortName: string | null };

async function typeOf(page: Page, key: string): Promise<DocType> {
  const res = await page.request.get("/api/admin/value-lists/document-types");
  const items = ((await res.json()) as { items: DocType[] }).items;
  const hit = items.find((i) => i.key === key);
  if (!hit) throw new Error(`no document type ${key}`);
  return hit;
}

/** „Tip" on the row holding `title`: its text and its tooltip. */
async function tipOf(page: Page, title: string): Promise<[string, string | null]> {
  await page.goto("/documents");
  const main = page.locator("main");
  const search = main.getByRole("searchbox", { name: "caută după cod, titlu sau nr. document" });
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill(MARK);
  await expect(main.locator("tbody tr").filter({ hasText: MARK })).toHaveCount(2, { timeout: 30_000 });
  const cell = main.locator("tbody tr").filter({ hasText: title }).locator("td").nth(1);
  return [(await cell.textContent())?.trim() ?? "", await cell.getAttribute("title")];
}

/** Date de referință → „Tipuri de Document", the row's „Deschide": the type's page, „General" (#38.39). */
async function editType(page: Page): Promise<{ dialog: Locator; field: Locator }> {
  await page.goto("/admin/value-lists");
  await page.getByRole("button", { name: "Tipuri de Document", exact: true }).click();
  const list = page.getByRole("region", { name: "Tipuri de Document" });
  const row = list.locator("tbody tr").filter({ hasText: TYPE });
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  await row.getByRole("link", { name: "Deschide", exact: true }).click();
  const dialog = page.getByRole("tabpanel");
  const field = dialog.getByRole("textbox", { name: "Denumire scurtă", exact: true });
  await expect(field).toBeVisible({ timeout: 30_000 });
  return { dialog, field };
}

/** „Salvează" on the type's page, and its „Salvat.". */
async function save(dialog: Locator): Promise<void> {
  await dialog.getByRole("button", { name: "Salvează", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Salvat.", { timeout: 15_000 });
}

test.describe("TC-DOC-15 — tipul prin denumirea lui scurtă", () => {
  test("„CVC” și „Intabulare”, o denumire schimbată, una refuzată, una goală", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 900 });
    await removeLeftovers(page.request, MARK);
    const before = await typeOf(page, "INCHEIERE_INTABULARE");
    const cvc = await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} CVC`);
    let inc: string | undefined;
    try {
      inc = await createDocumentOfType(page.request, "INCHEIERE_INTABULARE", `${MARK} Încheiere`);
      // Before you start — the seed's „Intabulare".
      if (before.shortName !== "Intabulare") {
        const { dialog, field } = await editType(page);
        await field.fill("Intabulare");
        await save(dialog);
      }

      // Step 1 — „CVC" and „Intabulare", the full names as tooltips.
      expect(await tipOf(page, `${MARK} CVC`)).toEqual(["CVC", "Contract de Vânzare"]);
      expect(await tipOf(page, `${MARK} Încheiere`)).toEqual(["Intabulare", TYPE]);

      // Step 2 — „Înch. intab." saved.
      {
        const { dialog, field } = await editType(page);
        await field.fill("Înch. intab.");
        await save(dialog);
        expect((await typeOf(page, "INCHEIERE_INTABULARE")).shortName).toBe("Înch. intab.");
      }

      // Step 3 — the list follows; the tooltip does not change.
      expect(await tipOf(page, `${MARK} Încheiere`)).toEqual(["Înch. intab.", TYPE]);

      // Step 4 — „CVC" refused, the fields stay open, nothing saved.
      {
        const { dialog, field } = await editType(page);
        await field.fill("CVC");
        await dialog.getByRole("button", { name: "Salvează", exact: true }).click();
        await expect(dialog.getByText(REFUSAL, { exact: true })).toBeVisible({ timeout: 15_000 });
        await expect(field).toHaveValue("CVC");
        expect((await typeOf(page, "INCHEIERE_INTABULARE")).shortName).toBe("Înch. intab.");

        // Step 5 — emptied: saved, „–", the list reads the rule's „Intabulare".
        await field.fill("");
        await save(dialog);
        expect((await typeOf(page, "INCHEIERE_INTABULARE")).shortName).toBeNull();
      }
      expect(await tipOf(page, `${MARK} Încheiere`)).toEqual(["Intabulare", TYPE]);
    } finally {
      // At the end — the short name as it was found, the two documents deleted.
      const now = await typeOf(page, "INCHEIERE_INTABULARE");
      if (now.shortName !== before.shortName) {
        const { dialog, field } = await editType(page);
        await field.fill(before.shortName ?? "");
        await save(dialog);
      }
      await removeRecord(page.request, "document", cvc);
      if (inc) await removeRecord(page.request, "document", inc);
    }
  });
});
