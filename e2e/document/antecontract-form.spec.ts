/**
 * Case:   TC-DOC-11 — Antecontractul fără câmpurile făcute de „discover"; contractul de vânzare își păstrează formularul
 * Source: docs/testing/cases/TC-DOC-11.md, „Last green" 2026-10-04
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The documents carry `TC-E2E-DOC-11` (records.ts).
 *   - „Sees" is read as the page's visible labels, as the hand runs read them.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-11`;
const FOURTEEN = [
  "CNP 1", "CNP 2", "CI seria IF nr.", "CI seria IF nr. 2", "nr. cad.", "nr. cadastral", "actul de lotizare aut. sub nr.",
  "contractul de vanzare-cumparare aut. sub nr.", "suma de", "diferența de", "ÎNCHEIERE DE AUTENTIFICARE NR.", "Anul", "luna",
  "S-a perceput onorariul de",
];

async function visibleLabels(page: Page, id: string): Promise<string[]> {
  await page.goto(`/documents/${id}`);
  await expect(page.locator("main label").filter({ hasText: /^Etichetă scurtă$/ }).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1000);
  return page.locator("main label").evaluateAll((els) =>
    els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map((e) => (e.textContent ?? "").trim()));
}

test.describe("TC-DOC-11 — Antecontractul fără câmpurile făcute de „discover”", () => {
  test("antecontractul: doar câmpurile generale; contractul de vânzare: formularul lui", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const antecontract = await createDocumentOfType(page.request, "ANTECONTRACT", `${MARK} Antecontract de test`);
    const contract = await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} Contract de test`);
    try {
      // Step 1 — the Antecontract: its general fields, none of the 14.
      const a = await visibleLabels(page, antecontract);
      for (const general of ["Tip document", "Etichetă scurtă", "Subiect", "Note extinse", "Nr. document"]) expect(a).toContain(general);
      for (const gone of FOURTEEN) expect(a).not.toContain(gone);

      // Step 2 — the contract: its own form.
      const c = await visibleLabels(page, contract);
      for (const kept of ["Monedă", "Stare plată", "Modalitate plată"]) expect(c).toContain(kept);
    } finally {
      await removeRecord(page.request, "document", antecontract);
      await removeRecord(page.request, "document", contract);
    }
  });
});
