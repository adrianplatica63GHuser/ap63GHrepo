/**
 * Case:   TC-PERS-06 — Lista persoanelor juridice: fără filtrul „Grupuri", „Persoană de contact" în „Câmpuri afișate"
 * Source: docs/testing/cases/TC-PERS-06.md, „Last green" 2026-10-03
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-PERS-06` (records.ts), and the list is
 *     searched for that.
 *   - A Playwright browser has never changed „Câmpuri afișate", so „Before you
 *     start" holds by itself and step 3 needs no clean-up after it.
 */

import { test, expect } from "@playwright/test";
import {
  E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord,
} from "../helpers/records";

const MARK = `${E2E_MARKER}PERS-06`;
const SEARCH = "caută după cod, nume, poreclă sau ID";

test.describe("TC-PERS-06 — lista persoanelor juridice", () => {
  test("fără „Grupuri”; „Persoană de contact” arată primul contact, sau al doilea când primul lipsește", async ({ page }) => {
    test.slow();
    // A run that died before its `finally` leaves its records; they would be a second match here.
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const unu = await createNaturalPerson(page.request, { lastName: `${MARK} Contact`, firstName: "Unu" });
    const doi = await createNaturalPerson(page.request, { lastName: `${MARK} Contact`, firstName: "Doi" });
    const company = async (name: string, slots: Record<string, string>): Promise<string> => {
      const res = await page.request.post("/api/judicial-persons", { data: { name, ...slots, provenance: "MANUAL" } });
      expect(res.ok(), await res.text()).toBeTruthy();
      return ((await res.json()) as { person: { id: string } }).person.id;
    };
    const a = await company(`${MARK} Firma A SRL`, { contactPerson1Id: unu, contactPerson2Id: doi });
    const b = await company(`${MARK} Firma B SRL`, { contactPerson2Id: doi });
    try {
      // Step 1 — the search box first, then „Câmpuri afișate 0/4"; no „Grupuri".
      await page.goto("/judicial-persons");
      const main = page.locator("main");
      const search = main.getByPlaceholder(SEARCH);
      await expect(search).toBeVisible({ timeout: 30_000 });
      const toolbar = search.locator("xpath=..");
      await expect(toolbar.locator(":scope > *").first()).toHaveAttribute("placeholder", SEARCH);
      await expect(toolbar.getByRole("button", { name: "Câmpuri afișate 0/4", exact: true })).toBeVisible();
      await expect(toolbar).not.toContainText("Grupuri");

      // Step 2 — „Persoană de contact" ticked; the search; Firma A „Unu …", Firma B „Doi …".
      await toolbar.getByRole("button", { name: "Câmpuri afișate 0/4", exact: true }).click();
      const picker = main.locator("[data-field-chooser]");
      await picker.getByRole("checkbox", { name: "Persoană de contact" }).check();
      await page.getByRole("heading", { level: 1 }).first().click();
      await expect(main.getByRole("button", { name: "Câmpuri afișate 1/4", exact: true })).toBeVisible();
      await search.fill(MARK);
      await expect(main.locator("tbody tr").filter({ hasText: MARK })).toHaveCount(2, { timeout: 30_000 });
      await expect(main.getByRole("columnheader", { name: "PERSOANĂ DE CONTACT" })).toBeVisible();
      await expect(main.locator("tbody tr").filter({ hasText: `${MARK} Firma A SRL` })).toContainText(`Unu ${MARK} Contact`);
      await expect(main.locator("tbody tr").filter({ hasText: `${MARK} Firma B SRL` })).toContainText(`Doi ${MARK} Contact`);

      // Step 3 — unticked: „0/4", the column gone.
      await main.getByRole("button", { name: "Câmpuri afișate 1/4", exact: true }).click();
      await picker.getByRole("checkbox", { name: "Persoană de contact" }).uncheck();
      await page.getByRole("heading", { level: 1 }).first().click();
      await expect(main.getByRole("button", { name: "Câmpuri afișate 0/4", exact: true })).toBeVisible();
      await expect(main.getByRole("columnheader", { name: "PERSOANĂ DE CONTACT" })).toHaveCount(0);
    } finally {
      await removeRecord(page.request, "company", a);
      await removeRecord(page.request, "company", b);
      await removeRecord(page.request, "person", unu);
      await removeRecord(page.request, "person", doi);
    }
  });
});
