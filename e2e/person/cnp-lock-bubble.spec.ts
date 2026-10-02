/**
 * Case:   TC-PERS-03 — CNP-ul salvat: nota despre blocare într-un balon, iar o schimbare salvată e refuzată în română
 * Source: docs/testing/cases/TC-PERS-03.md, „Last green" 2026-10-02
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - „Nume" is `TC-E2E-PERS-03` (records.ts), and the CNPs are other
 *     synthetic ones — `1800101420045` saved, `1800101420053` typed — so a
 *     hand run's person left behind cannot collide with the spec's on the
 *     CNP's unique index. Both carry a valid check digit, as the case's do.
 *   - The hand run's pane was hidden (dispatched hover, a scripted click on
 *     „Salvează"); here it is Playwright's real mouse and keyboard.
 *   - „Shown" / „gone" are read as the case defines them: the bubble is the
 *     field's description, so it is always in the document; shown is the
 *     element without `sr-only`, gone is with it.
 *   - Slice #37.50's pictures, not steps of the case: the identity tile at
 *     rest and with the bubble open, at 1366 and 1920 px, into
 *     `playwright-report/cnp-lock-bubble/`. The sidebar's „Recente" list is
 *     painted over. The CNP on them is synthetic.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}PERS-03`;
const SAVED_CNP = "1800101420045";
const CHANGED_CNP = "1800101420053";
const SENTENCE = "CNP-ul nu poate fi modificat odată setat — ștergeți și creați din nou pentru a-l schimba";
const SHOTS = "playwright-report/cnp-lock-bubble";

const recent = (page: Page) =>
  page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

async function photograph(page: Page, name: string, before: () => Promise<void>): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await before();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, clip: { x: 0, y: 0, width, height: 520 }, mask: [recent(page)] });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-PERS-03 — nota CNP-ului într-un balon, refuzul în română", () => {
  test("balonul la mouse și la tastatură; o schimbare salvată e refuzată", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    let personId: string | undefined;
    try {
      personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Persoană", cnp: SAVED_CNP });

      // Step 1 — the person: the CNP editable, nothing under it, named `CNP`, described by the sentence.
      await page.goto(`/natural-persons/${personId}`);
      await expect(page.getByRole("heading", { level: 1, name: `Persoană ${MARK}`, exact: true })).toBeVisible({ timeout: 30_000 });
      const cnp = page.getByRole("textbox", { name: "CNP", exact: true });
      await expect(cnp).toHaveValue(SAVED_CNP);
      await expect(cnp).toBeEditable();
      await expect(cnp).toHaveAccessibleDescription(SENTENCE);
      const label = page.locator("label").filter({ has: cnp });
      await expect(label.getByRole("button")).toHaveCount(0);
      const describedBy = await cnp.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      const bubble = page.locator(`[id="${describedBy}"]`);
      await expect(bubble).toHaveText(SENTENCE);
      await expect(bubble).toHaveAttribute("role", "tooltip");
      await expect(bubble).toHaveClass(/(^|\s)sr-only(\s|$)/);
      await photograph(page, "identity-at-rest", async () => {
        await page.mouse.move(5, 5);
        await expect(bubble).toHaveClass(/(^|\s)sr-only(\s|$)/);
      });

      // Step 2 — the mouse over the CNP box: the bubble, reading the sentence.
      await cnp.hover();
      await expect(bubble).not.toHaveClass(/(^|\s)sr-only(\s|$)/);
      await expect(bubble).toBeVisible();
      await photograph(page, "identity-bubble-open", async () => {
        await cnp.hover();
        await expect(bubble).not.toHaveClass(/(^|\s)sr-only(\s|$)/);
      });

      // Step 3 — the mouse away: gone.
      await page.mouse.move(5, 5);
      await expect(bubble).toHaveClass(/(^|\s)sr-only(\s|$)/);

      // Step 4 — the keyboard focus into the CNP, Shift+Tab from the field after it.
      await page.locator('input[name="dateOfBirth"]').focus();
      await page.keyboard.press("Shift+Tab");
      await expect(cnp).toBeFocused();
      await expect(bubble).not.toHaveClass(/(^|\s)sr-only(\s|$)/);

      // Step 5 — Escape: gone, the focus still in the CNP.
      await page.keyboard.press("Escape");
      await expect(bubble).toHaveClass(/(^|\s)sr-only(\s|$)/);
      await expect(cnp).toBeFocused();

      // Step 6 — a changed CNP saved: the sentence in red, in Romanian; still unsaved; the stored CNP unchanged.
      await cnp.fill(CHANGED_CNP);
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page.locator("p.text-red-600").filter({ hasText: SENTENCE })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("cannot be changed")).toHaveCount(0);
      await expect(page.getByText("Modificări nesalvate").first()).toBeVisible();
      const stored = await page.request.get(`/api/people/${personId}`);
      expect(stored.ok()).toBeTruthy();
      expect(JSON.stringify(await stored.json())).toContain(`"cnp":"${SAVED_CNP}"`);
    } finally {
      // At the end — leaving without saving, then deleting the person.
      if (personId) await removeRecord(page.request, "person", personId);
    }
  });
});
