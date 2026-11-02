/**
 * Case:   TC-PERS-15 — Persoana fizică citită ca text; „Editează” pe o dală, „Salvează” o versiune, „Renunță”
 * Source: docs/testing/cases/TC-PERS-15.md, „Last green" 2026-10-25
 *
 * A translation of the case file, step for step, on an invented person (`TC-E2E-PERS-15`, records.ts). The tiles are
 * read by their marks: a value read as text is `data-read-value`, „Editează" `data-tile-edit`, the open tile's bar
 * `data-tile-edit-bar`. The versions are read from the record's own API and the „N versiuni" pill.
 */
import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createCompany, createNaturalPerson, createProperty, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";
import { editTile, expectEditInCorner, saveTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}PERS-15`;

/** Whole years from 15.06.1985 to today. */
function ageToday(): number {
  const now = new Date();
  return now.getFullYear() - 1985 - (now.getMonth() < 5 || (now.getMonth() === 5 && now.getDate() < 15) ? 1 : 0);
}

async function versionCount(page: Page, id: string): Promise<number> {
  const res = await page.request.get(`/api/people/${id}/versions`);
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { items: unknown[] }).items.length;
}

test.describe("TC-PERS-15 — persoana fizică citită ca text, „Editează” pe o dală", () => {
  test("citită ca text; „Editează”, „Salvează” — o versiune; „Renunță”; ghidul la schimbarea dalei; Esc", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    let id: string | undefined;
    try {
      id = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Citit", dateOfBirth: "1985-06-15", personalPhone2: "0700 000 015" });
      await page.goto(`/natural-persons/${id}`);
      await expect(page.getByRole("heading", { level: 1, name: `Citit ${MARK}`, exact: true })).toBeVisible({ timeout: 30_000 });
      const identity = page.locator('[data-panel="identity"]');
      const contact = page.locator('[data-panel="contact"]');
      const before = await versionCount(page, id);

      // Step 1 — read as text: no box in the tiles, the birth date with the age, „Editează" in each corner, no
      // record-level „Salvează".
      await expect(identity.locator('[data-read-value="lastName"]')).toHaveText(MARK);
      await expect(identity.locator('[data-read-value="dateOfBirth"]')).toHaveText(`15.06.1985 (${ageToday()} ani)`); // 41.23: „ani”, no „de”
      await expect(identity.getByRole("textbox")).toHaveCount(0);
      await expect(contact.getByRole("textbox")).toHaveCount(0);
      await expect(contact.locator('[data-read-value="personalPhone2"]')).toHaveText("0700 000 015");
      for (const tile of ["identity", "contact"]) await expect(page.locator(`[data-tile-edit="${tile}"]`)).toBeVisible();
      await expect(page.getByRole("button", { name: "Editează — Identitate", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Salvează", exact: true })).toHaveCount(0);

      // Step 2 — „Editează" on „Contact": outlined in blue, its six boxes, the focus in the first; „Salvează", „Renunță".
      await editTile(page, "contact");
      await expect(contact).toHaveClass(/(^|\s)outline-2(\s|$)/);
      await expect(contact.getByRole("textbox")).toHaveCount(6);
      await expect(contact.getByRole("textbox", { name: "Telefon Personal 1", exact: true })).toBeFocused();
      await expect(contact.getByRole("button", { name: "Renunță", exact: true })).toBeVisible();
      await expect(identity.getByRole("textbox")).toHaveCount(0);

      // Step 3 — a phone written, „Salvează": one version more, the tile reads again with the new phone.
      await contact.getByRole("textbox", { name: "Telefon serviciu", exact: true }).fill("021 000 0015");
      await saveTile(page, "contact");
      await expect(contact.locator('[data-read-value="workPhone"]')).toHaveText("021 000 0015");
      await expect.poll(() => versionCount(page, id!), { timeout: 15_000 }).toBe(before + 1);
      const stored = (await (await page.request.get(`/api/people/${id}`)).json()) as { natural: { workPhone: string | null; lastName: string | null } };
      expect([stored.natural.workPhone, stored.natural.lastName]).toEqual(["021 000 0015", MARK]);

      // Step 4 — „Editează" on „Identitate", „Poreclă" written, „Renunță": as it was, no version.
      await editTile(page, "identity");
      await identity.getByRole("textbox", { name: "Poreclă", exact: true }).fill("Schimbat");
      await identity.getByRole("button", { name: "Renunță", exact: true }).click();
      await expect(identity.getByRole("textbox")).toHaveCount(0);
      await expect(identity.getByText("Schimbat")).toHaveCount(0);
      expect(await versionCount(page, id)).toBe(before + 1);

      // Step 5 — „Identitate" changed, then „Editează" on „Contact": the guard asks; „Anulează" stays; „Renunță" opens
      // „Contact" with „Identitate" as it was.
      await editTile(page, "identity");
      await identity.getByRole("textbox", { name: "Poreclă", exact: true }).fill("Schimbat");
      await page.locator('[data-tile-edit="contact"]').click();
      const guard = page.getByRole("dialog", { name: "Modificări nesalvate" });
      await expect(guard).toBeVisible();
      await guard.getByRole("button", { name: "Anulează", exact: true }).click();
      await expect(guard).toHaveCount(0);
      await expect(identity.getByRole("textbox", { name: "Poreclă", exact: true })).toHaveValue("Schimbat");
      await page.locator('[data-tile-edit="contact"]').click();
      await guard.getByRole("button", { name: "Renunță", exact: true }).click();
      await expect(page.locator('[data-tile-edit-bar="contact"]')).toBeVisible();
      await expect(identity.getByRole("textbox")).toHaveCount(0);
      await expect(identity.getByText("Schimbat")).toHaveCount(0);

      // Step 6 — Esc with nothing changed: „Contact" reads again.
      await contact.getByRole("textbox", { name: "Telefon Personal 1", exact: true }).focus();
      await page.keyboard.press("Escape");
      await expect(page.locator('[data-tile-edit-bar="contact"]')).toHaveCount(0);
      expect(await versionCount(page, id)).toBe(before + 1);
    } finally {
      if (id) await removeRecord(page.request, "person", id);
    }
  });
});

// Slice 41.38 — Adrian: „For all tiles move the Edit button up so it has the same gap to the upper edge of the tile as it
// has to the right edge of the tile". One tile per screen, on invented records: the person's and the firm's identity, the
// property's first tile with a pen, and a contract's. (Clasificare is the same TileTitle — tile-title-action.test.tsx —
// and folds to its one line on a new record, with no pen to measure.)
test.describe("TC-PERS-15 (41.38) — „Editează” în colțul dalei", () => {
  test("persoană, firmă, proprietate, contract", async ({ page }) => {
    test.slow();
    const MARK38 = `${E2E_MARKER}PERS-15-COLT`;
    await removeLeftovers(page.request, MARK38);
    await page.setViewportSize({ width: 1366, height: 900 });
    const made: [Parameters<typeof removeRecord>[1], string][] = [];
    try {
      const person = await createNaturalPerson(page.request, { lastName: MARK38, firstName: "Colț" });
      made.push(["person", person]);
      await page.goto(`/natural-persons/${person}`);
      await expect(page.locator('[data-panel="identity"] [data-tile-edit]')).toBeVisible({ timeout: 30_000 });
      const corner = await expectEditInCorner(page.locator('[data-panel="identity"]'));
      expect(corner.top, "the pen at the tile's padding, not under the title").toBeLessThan(20);

      const firm = await createCompany(page.request, { name: `${MARK38} SRL` });
      made.push(["company", firm]);
      await page.goto(`/judicial-persons/${firm}`);
      await expect(page.locator('[data-panel="identity"] [data-tile-edit]')).toBeVisible({ timeout: 30_000 });
      await expectEditInCorner(page.locator('[data-panel="identity"]'));

      const property = await createProperty(page.request, { nickname: `${MARK38} Teren` });
      made.push(["property", property]);
      await page.goto(`/properties/${property}`);
      const cadastral = page.locator("section:has(> [data-tile-title] [data-tile-edit])").first();
      await expect(cadastral).toBeVisible({ timeout: 30_000 });
      await expectEditInCorner(cadastral);

      const contract = await createSaleContract(page.request, `${MARK38} CVC`);
      made.push(["document", contract]);
      await page.goto(`/documents/${contract}`);
      await expect(page.locator("[data-tile-edit]").first()).toBeVisible({ timeout: 30_000 });
      await expectEditInCorner(page.locator("section:has(> [data-tile-title] [data-tile-edit])").first());
    } finally {
      for (const [kind, id] of made) await removeRecord(page.request, kind, id);
    }
  });
});
