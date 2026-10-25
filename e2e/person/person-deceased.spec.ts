/**
 * Case:   TC-PERS-11 — „Decedat”: bifat, datat, refuzat înainte de naștere, debifat; vârsta se oprește la deces
 * Source: docs/testing/cases/TC-PERS-11.md, „Last green" 2026-10-14
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The person is created through the route the form calls, `TC-E2E-PERS-11` (records.ts), and deleted in
 *     `finally`. Born 01.05.1921, so the age is the same on any day until 01.05.2027: Vârstă reads it from today.
 *   - A date is typed into the date box with `fill`, as Playwright does for every date on these forms.
 */

import { test, expect } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { editTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}PERS-11`;
const BEFORE_BIRTH = "nu poate fi înainte de";

test.describe("TC-PERS-11 — „Decedat” și „Data decesului”", () => {
  test("bifat și datat, vârsta oprită la deces; refuzat înainte de naștere; debifat, data ștearsă", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    let personId: string | undefined;
    const stored = async () => ((await (await page.request.get(`/api/people/${personId}`)).json()) as { natural: { isDeceased: boolean; dateOfDeath: string | null } }).natural;
    try {
      personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion", dateOfBirth: "1921-05-01" });
      const ageNow = new Date().getFullYear() - 1921 - (new Date() < new Date(new Date().getFullYear(), 4, 1) ? 1 : 0);

      // Step 1 — „Decedat" unticked, „Data decesului" not to be filled, „Vârstă" counted to today.
      await page.goto(`/natural-persons/${personId}`);
      await expect(page.getByRole("heading", { level: 1, name: `Ion ${MARK}`, exact: true })).toBeVisible({ timeout: 30_000 });
      // 40.72: the person reads as text; „Editează" opens „Identitate", every field drawn (40.71's hidden ones too).
      await editTile(page, "identity");
      const deceased = page.getByRole("checkbox", { name: "Decedat", exact: true });
      const date = page.locator('input[name="dateOfDeath"]');
      const age = page.locator('[data-width-field="age"]');
      await expect(deceased).not.toBeChecked();
      await expect(date).toBeDisabled();
      await expect(age).toHaveText(String(ageNow));

      // Step 2 — ticked: the date can be filled; no date yet, so no age.
      await deceased.check();
      await expect(date).toBeEnabled();
      await expect(age).toHaveText("—");

      // Step 3 — 30.04.1998: „76 †"; saved, the person is dead on that day.
      await date.fill("1998-04-30");
      await expect(age).toHaveText("76 †");
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect.poll(stored, { timeout: 15_000 }).toEqual(expect.objectContaining({ isDeceased: true, dateOfDeath: "1998-04-30" }));

      // Step 4 — the list: „†" after the name.
      await page.goto(`/natural-persons?q=${encodeURIComponent(MARK)}`);
      const row = page.locator("tr").filter({ hasText: `Ion ${MARK}` });
      await expect(row.locator("[data-deceased]")).toHaveAttribute("title", "Decedat", { timeout: 30_000 });

      // Step 5 — a date before the birth: refused, in Romanian, under the date; nothing saved.
      await page.goto(`/natural-persons/${personId}`);
      await editTile(page, "identity");
      await expect(deceased).toBeChecked({ timeout: 30_000 });
      await date.fill("1900-01-01");
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page.getByText(BEFORE_BIRTH).first()).toBeVisible({ timeout: 15_000 });
      expect(await stored()).toEqual(expect.objectContaining({ isDeceased: true, dateOfDeath: "1998-04-30" }));

      // Step 6 — unticked: the date emptied and closed; saved, the person is alive and has no date of death.
      await deceased.uncheck();
      await expect(date).toHaveValue("");
      await expect(date).toBeDisabled();
      await expect(age).toHaveText(String(ageNow));
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect.poll(stored, { timeout: 15_000 }).toEqual(expect.objectContaining({ isDeceased: false, dateOfDeath: null }));
    } finally {
      if (personId) await removeRecord(page.request, "person", personId);
    }
  });
});
