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
 *   - Steps 7–10 (Slice 40.56) read the computed style — the colours, the label's family and size — where the
 *     case says what a person sees.
 *   - Slice #37.50's pictures, not steps of the case: the identity tile at
 *     rest and with the bubble open, at 1366 and 1920 px, into
 *     `playwright-report/cnp-lock-bubble/`. The sidebar's „Recente" list is
 *     painted over. The CNP on them is synthetic.
 */

import { test, expect, type Page } from "../helpers/test";
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

      // Slice 40.56 — calm fields, and a field's label told apart from its value.
      const identity = page.locator('[data-panel="identity"]');
      const lastName = identity.getByRole("textbox", { name: "Nume", exact: true });
      const firstName = identity.getByRole("textbox", { name: "Prenume", exact: true });
      const nickname = identity.getByRole("textbox", { name: "Poreclă", exact: true });
      const CLEAR = "rgba(0, 0, 0, 0)";
      await page.mouse.move(5, 5);

      // Step 7 — „Nume" at rest: no border, no fill, no shadow; its label in Roboto Condensed at 12 px, the value at 14.
      await expect(lastName).toHaveCSS("border-top-color", CLEAR);
      await expect(lastName).toHaveCSS("background-color", CLEAR);
      expect(await lastName.evaluate((el) => getComputedStyle(el).boxShadow)).toMatch(/^(none|(rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(, )?)+)$/);
      const lastNameLabel = identity.locator("label").filter({ has: page.getByRole("textbox", { name: "Nume", exact: true }) }).locator(":scope > span").first();
      await expect(lastNameLabel).toHaveText("Nume");
      await expect(lastNameLabel).toHaveCSS("font-size", "12px");
      expect(await lastNameLabel.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Roboto Condensed/);
      await expect(lastName).toHaveCSS("font-size", "14px");
      expect(await lastName.evaluate((el) => getComputedStyle(el).fontFamily)).not.toMatch(/Roboto Condensed/);
      expect(await lastNameLabel.evaluate((el) => getComputedStyle(el).color)).not.toBe(await lastName.evaluate((el) => getComputedStyle(el).color));

      // Step 8 — the mouse over „Prenume": the white box with the grey border.
      await firstName.hover();
      await expect(firstName).toHaveCSS("border-top-color", "rgb(192, 196, 204)");
      await expect(firstName).toHaveCSS("background-color", "rgb(255, 255, 255)");
      await page.mouse.move(5, 5);
      await expect(firstName).toHaveCSS("border-top-color", CLEAR);

      // Step 9 — „Poreclă", empty: a dashed underline at rest; in focus the blue border and its ring.
      await expect(nickname).toHaveValue("");
      await expect(nickname).toHaveCSS("border-bottom-style", "dashed");
      await expect(nickname).toHaveCSS("border-top-color", CLEAR);
      await nickname.focus();
      await expect(nickname).toHaveCSS("border-bottom-style", "solid");
      await expect(nickname).toHaveCSS("border-top-color", "rgb(26, 82, 150)");
      expect(await nickname.evaluate((el) => getComputedStyle(el).boxShadow)).not.toMatch(/^(none|(rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(, )?)+)$/);

      // Step 10 — „Până la" a past date: its red border at rest, and „EXPIRAT".
      const validUntil = page.locator('input[name="idValidUntil"]');
      await validUntil.fill("2020-01-01");
      await page.mouse.move(5, 5);
      await lastName.focus();
      const red = await validUntil.evaluate((el) => getComputedStyle(el).borderTopColor);
      expect(red).not.toBe(CLEAR);
      // Tailwind 4's red-500, as Chromium reports it (lab), or as oklch / sRGB elsewhere.
      expect(red).toMatch(/lab\(55\.48|oklch\(0\.637 0\.237 25\.3|rgb\(239, 68, 68\)/);
      await expect(page.locator('[data-panel="id-card"]').getByText("Expirat", { exact: false })).toBeVisible();
    } finally {
      // At the end — leaving without saving, then deleting the person.
      if (personId) await removeRecord(page.request, "person", personId);
    }
  });
});
