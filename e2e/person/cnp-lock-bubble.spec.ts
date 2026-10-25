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
 *   - Steps 7–9 and 13 (Slice 40.56) read the computed style — the colours, the label's family and size — where the
 *     case says what a person sees.
 *   - Steps 10–12 (Slice 40.64) read „one line" as the tile's height: at most 64 px, a filled tile being several
 *     times that.
 *   - Since Slice 40.72 a saved person reads as text; the first test opens „Identitate" with „Editează" before step 1
 *     (an open tile shows every field, 40.71's hidden ones too), puts it back with „Renunță" after step 9 so step 11's
 *     „Adaugă" opens „Contact" without the guard asking, and puts „Adrese" back before step 13 for the same reason.
 *     Steps 14–16 are the second test, on a person of its own whose „Contact" holds two of its six, read as text.
 *   - Slice #37.50's pictures, not steps of the case: the identity tile at
 *     rest and with the bubble open, at 1366 and 1920 px, into
 *     `playwright-report/cnp-lock-bubble/`. The sidebar's „Recente" list is
 *     painted over. The CNP on them is synthetic.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { editTile, emptyTileLine, openEmptyTile } from "../helpers/tiles";
import { emptyFieldsLink } from "../helpers/empty-fields";

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
      // Slice 40.72: the person reads as text; „Editează" opens „Identitate", every field drawn.
      await editTile(page, "identity");
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

      // Slice 40.72: „Renunță" puts „Identitate" back (the refused CNP with it), so step 11 opens „Contact" unasked.
      await page.locator('[data-tile-cancel="identity"]').click();
      await expect(page.locator('[data-tile-edit-bar="identity"]')).toHaveCount(0);

      // Step 10 — Slice 40.64: the four empty tiles, each one line — its title, its state, „Adaugă".
      const lines = {
        contact: ["Contact", "necompletat"],
        idCard: ["Act de identitate", "niciun act înregistrat"],
        home: ["Adresă domiciliu", "necompletat"],
        correspondence: ["Adresă corespondență", "necompletat"],
      } as const;
      for (const [tile, [title, state]] of Object.entries(lines)) {
        const line = emptyTileLine(page, tile);
        await expect(line).toBeVisible();
        await expect(line.getByRole("heading", { name: title, exact: true })).toBeVisible();
        await expect(line.locator("[data-empty-tile-state]")).toHaveText(state);
        await expect(line.getByRole("button", { name: `Adaugă — ${title}` })).toBeVisible();
      }
      const contactPanel = page.locator('[data-panel="contact"]');
      expect((await contactPanel.boundingBox())!.height).toBeLessThanOrEqual(64);

      // Step 11 — „Adaugă" on „Contact": the whole form, the focus in „Telefon Personal 1".
      await emptyTileLine(page, "contact").getByRole("button").click();
      await expect(emptyTileLine(page, "contact")).toHaveCount(0);
      await expect(contactPanel.getByRole("textbox", { name: "Telefon Personal 1", exact: true })).toBeFocused();
      expect((await contactPanel.boundingBox())!.height).toBeGreaterThan(128);

      // Step 12 — the home address opened, its box ticked: the correspondence reads „aceeași cu domiciliul".
      await openEmptyTile(page, "home");
      await page.getByRole("checkbox", { name: "Adresa de corespondență aceeași cu domiciliul" }).check();
      await expect(emptyTileLine(page, "correspondence").locator("[data-empty-tile-state]")).toHaveText("aceeași cu domiciliul");

      // Step 13 — „Până la" a past date: its red border at rest, and „EXPIRAT". (40.72: „Adrese" put back first.)
      await page.locator('[data-tile-cancel="addresses"]').click();
      await openEmptyTile(page, "idCard");
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

  test("câmpurile goale ale unei dale completate în parte, sub „Arată N câmpuri goale” (40.71)", async ({ page }) => {
    const MARK71 = `${E2E_MARKER}PERS-03-GOALE`;
    await removeLeftovers(page.request, MARK71);
    await page.setViewportSize({ width: 1366, height: 900 });
    let personId: string | undefined;
    try {
      // Invented: „Contact" holds two of its six — „Telefon Personal 2" and „Email serviciu"; no CNP.
      personId = await createNaturalPerson(page.request, { lastName: MARK71, firstName: "Goale", personalPhone2: "0700 000 002", workEmail: "goale@example.invalid" });
      await page.goto(`/natural-persons/${personId}`);
      await expect(page.getByRole("heading", { level: 1, name: `Goale ${MARK71}`, exact: true })).toBeVisible({ timeout: 30_000 });

      // Step 14 — „Contact": its two values, then „Arată 4 câmpuri goale" and the four names in grey, all in its tooltip.
      const contact = page.locator('[data-panel="contact"]');
      const link = emptyFieldsLink(contact, "contact");
      const HIDDEN = ["Telefon Personal 1", "Telefon serviciu", "Email Personal 1", "Email Personal 2"];
      await expect(link).toHaveText("Arată 4 câmpuri goale");
      await expect(contact.locator("[data-empty-fields-names]")).toHaveText(HIDDEN.join(", "));
      await expect(link).toHaveAttribute("title", `Câmpuri goale: ${HIDDEN.join(", ")}`);
      // Slice 40.72: read as text.
      await expect(contact.locator('[data-read-value="personalPhone2"]')).toHaveText("0700 000 002");
      await expect(contact.locator('[data-read-value="workEmail"]')).toHaveText("goale@example.invalid");
      for (const name of ["personalPhone1", "workPhone", "personalEmail1", "personalEmail2"]) {
        await expect(contact.locator(`[data-read-value="${name}"]`)).toBeHidden();
      }

      // Step 15 — „Identitate": the CNP shows, empty; the other empty fields are behind its own link.
      const identity = page.locator('[data-panel="identity"]');
      await expect(identity.locator('[data-read-value="cnp"]')).toBeVisible();
      await expect(identity.locator('[data-read-value="cnp"]')).toHaveText("—");
      await expect(emptyFieldsLink(identity, "identity")).toHaveText("Arată 8 câmpuri goale");
      await expect(identity.locator('[data-read-value="nickname"]')).toBeHidden();

      // Step 16 — the link pressed: all six boxes, no link; a box typed into and emptied again stays; „Identitate" is
      // still behind its own.
      await link.click();
      await expect(link).toHaveCount(0);
      for (const name of ["personalPhone1", "personalPhone2", "workPhone", "personalEmail1", "personalEmail2", "workEmail"]) {
        await expect(contact.locator(`[data-read-value="${name}"]`)).toBeVisible();
      }
      // 40.72: typed into in the open tile.
      await editTile(page, "contact");
      const workPhone = contact.getByRole("textbox", { name: "Telefon serviciu", exact: true });
      await workPhone.fill("021 000 0000");
      await workPhone.fill("");
      await expect(workPhone).toBeVisible();
      await expect(emptyFieldsLink(identity, "identity")).toBeVisible();
    } finally {
      if (personId) await removeRecord(page.request, "person", personId);
    }
  });
});
