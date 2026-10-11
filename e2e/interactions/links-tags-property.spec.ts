/**
 * Case:   TC-INT-03 — „Interacțiuni": acte legate, etichete și o proprietate
 * Source: docs/testing/cases/TC-INT-03.md, „Last green" 2026-10-10
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The person, the two documents and the property carry `TC-E2E-INT-03` (records.ts) and are created through the
 *     API; the screen is opened scoped to the person.
 *   - Step 6 reads the saved property through GET /api/interactions/<id> — the grid does not show it (Ask first #2).
 *   - The tag is `TC-E2E-INT-03 contract`, so the suggestion it looks for is the case's own.
 *   - The picture for Slice #38.86's handover goes to playwright-report/interactions-links, invented records only.
 *   - Slice #39.06: the log form is on the person's screen (C, #39.05), so steps 1–4 and 7 run on Radu's screen
 *     (`?log=new`); the paperclip's popover (step 5) is the history's, A's, so it is read there, scoped to Radu.
 *     Every assertion is unchanged.
 */

import fs from "node:fs";
import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createDocumentOfType, createNaturalPerson, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}INT-03`;
const TAG = `${MARK} contract`;
const SHOTS = "playwright-report/interactions-links";

async function picture(page: Page, name: string): Promise<void> {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.mouse.move(1, 1);
  await page.locator("[data-log-documents]").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${SHOTS}/${name}.png`,
    mask: [
      page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) }),
      page.locator("aside").getByText(/^Autentificat ca/),
    ],
  });
}

test.describe("TC-INT-03 — acte legate, etichete și o proprietate", () => {
  test("două acte legate, agrafa „2” le deschide; o etichetă sugerată data următoare; proprietatea salvată", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const person = await createNaturalPerson(page.request, { lastName: `${MARK} Stan`, firstName: "Radu" });
    const act1 = await createDocumentOfType(page.request, "ADEVERINTA", `${MARK} Contract v3`);
    const act2 = await createDocumentOfType(page.request, "ADEVERINTA", `${MARK} Extras CF`);
    const prop = await createProperty(page.request, { nickname: `${MARK} Livada` });
    try {
      await page.setViewportSize({ width: 1920, height: 1080 });
      const log = page.locator("[data-interactions-log]");
      await page.goto(`/natural-persons/${person}?log=new`); // #39.06: was `/interactions?person=${person}`
      await expect(log.getByRole("heading", { name: "Înregistrează o interacțiune" })).toBeVisible({ timeout: 30_000 });
      await log.getByLabel("Subiect", { exact: true }).fill("Vizită pe teren");

      // Step 1 — „Adaugă legătură", twice: the two documents, each a row with its „×".
      for (const title of [`${MARK} Contract v3`, `${MARK} Extras CF`]) {
        await log.getByRole("button", { name: "Adaugă legătură", exact: true }).click();
        await log.getByRole("combobox", { name: "Caută un act" }).fill(title);
        await log.getByRole("listbox").getByRole("button", { name: title, exact: true }).click();
      }
      const linked = log.locator("[data-linked-document]");
      await expect(linked).toHaveText([`${MARK} Contract v3`, `${MARK} Extras CF`]);
      // A document already linked is not offered again.
      await log.getByRole("button", { name: "Adaugă legătură", exact: true }).click();
      await log.getByRole("combobox", { name: "Caută un act" }).fill(`${MARK} Contract v3`);
      await expect(log.getByText("Nimic găsit", { exact: true })).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press("Escape");

      // Step 2 — „Adaugă etichetă": the tag typed and Enter; a chip.
      await log.getByRole("button", { name: "Adaugă etichetă", exact: true }).click();
      await log.getByRole("combobox", { name: "Etichetă nouă" }).fill(TAG);
      await page.keyboard.press("Enter");
      await expect(log.locator("[data-tag-chip]")).toHaveText([TAG]);

      // Step 3 — „Proprietate legată": the property found and chosen.
      await log.getByRole("combobox", { name: "Caută o proprietate" }).fill(`${MARK} Livada`);
      await log.getByRole("listbox").getByRole("button", { name: `${MARK} Livada`, exact: true }).click();
      await expect(log.locator("[data-related-property]")).toContainText(`${MARK} Livada`);
      await picture(page, "log-links-1920");

      // Step 4 — „Salvează": the row shows the paperclip and „2".
      const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/api/interactions"));
      await log.getByRole("button", { name: "Salvează", exact: true }).click();
      const record = (await (await saved).json()) as { id: string; relatedPropertyId: string | null; tags: string[] };
      // #39.06: the row of his history on his screen (it read the module's grid row).
      await expect(page.locator(`[data-person-interaction="${record.id}"] [data-documents-count]`)).toHaveText("2", { timeout: 30_000 });

      // Step 5 — the paperclip: both documents; „Contract v3" opens the archive's document. (#39.06: the popover is
      // the history's on the Rapoarte screen, A scoped to Radu.)
      await page.goto(`/interactions?person=${person}`);
      const row = page.locator(`[data-interaction-row="${record.id}"]`);
      await expect(row.locator("[data-documents-count]")).toHaveText("2", { timeout: 30_000 });
      await row.locator("[data-documents-count]").click();
      const popover = page.locator("[data-documents-popover]");
      await expect(popover.getByRole("button")).toHaveText([`${MARK} Contract v3`, `${MARK} Extras CF`]);
      await popover.getByRole("button", { name: `${MARK} Contract v3`, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${act1}$`), { timeout: 30_000 });

      // Step 6 — the property and the tag were saved with the record.
      const back = await page.request.get(`/api/interactions/${record.id}`);
      expect(await back.json()).toMatchObject({ relatedPropertyId: prop, tags: [TAG], documentIds: [act1, act2] });

      // Step 7 — a new record: „Adaugă etichetă" suggests the tag just used.
      await page.goto(`/natural-persons/${person}?log=new`); // #39.06: was `/interactions?person=${person}`
      await log.getByRole("button", { name: "Adaugă etichetă", exact: true }).click();
      await log.getByRole("combobox", { name: "Etichetă nouă" }).fill(MARK);
      await expect(log.locator("[data-tag-suggestions]").getByRole("button", { name: TAG, exact: true })).toBeVisible({ timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "person", person);
      await removeRecord(page.request, "document", act1);
      await removeRecord(page.request, "document", act2);
      await removeRecord(page.request, "property", prop);
    }
  });
});
