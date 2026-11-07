/**
 * Case:   TC-TILES-08 — META INFO în două: „Clasificări" și „Conexiuni", explicațiile în bule
 * Source: docs/testing/cases/TC-TILES-08.md, „Last green" 2026-10-02
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-08` (records.ts).
 *   - A Playwright browser has never chosen, so the property opens with its
 *     defaults plus the two tiles `?tab=metadata` adds.
 *   - Slice #37.63's pictures, not steps of the case: the two tiles on the
 *     property and on the document, at 1366 and 1920 px, and their sizes, into
 *     `playwright-report/meta-info-split/` (after-*.png, after.json) — the
 *     „before" pictures were taken by an earlier version of this file.
 */

import fs from "node:fs";
import { test, expect, type Locator, type Page } from "../helpers/test";
import {
  E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, createProperty, removeLeftovers, removeRecord,
} from "../helpers/records";
import { tileBox } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-08`;
const SHOTS = "playwright-report/meta-info-split";
const CLASSIFICATION = "Clasificare";
const CONNECTIONS = "Etichete și grupuri";
// Slice 41.96: „Vezi și" is a tile of its own, the third of the rose group.
const REFERENCES = "Alte referințe";

/** Step 1's reading, on any record's screen opened with `?tab=metadata`. */
async function twoTiles(page: Page, url: string): Promise<{ cls: Locator; con: Locator }> {
  await page.goto(url);
  const cls = page.getByRole("region", { name: CLASSIFICATION, exact: true });
  const con = page.getByRole("region", { name: CONNECTIONS, exact: true });
  await expect(cls).toBeVisible({ timeout: 30_000 });
  await expect(con).toBeVisible();
  await expect(tileBox(page, CLASSIFICATION)).toBeChecked();
  await expect(tileBox(page, CONNECTIONS)).toBeChecked();
  // 41.96: `?tab=metadata` adds „Alte referințe" too, ticked in the rose group; its surface is the other two's.
  const refs = page.getByRole("region", { name: REFERENCES, exact: true });
  await expect(refs).toBeVisible();
  await expect(tileBox(page, REFERENCES)).toBeChecked();
  const ground = (l: Locator) => l.evaluate((el) => getComputedStyle(el.closest("[data-tile]") ?? el).backgroundColor);
  expect(await ground(refs)).toBe(await ground(con));
  await expect(tileBox(page, "META INFO")).toHaveCount(0);
  // 41.94: no „Istoric" (Adrian: „Remove the History section at the bottom").
  await expect(cls.locator("h3, h4")).toHaveText(["Importanță", "Relevanță", "Proveniență"], { timeout: 30_000 });
  // 41.96 rewritten in place — was ["…", "Ștampile", "Vezi și"]: „Vezi și" left for „Alte referințe", whose title names it.
  await expect(con.locator("h3")).toHaveText(["Etichete / Cuvinte cheie", "Grupuri", "Ștampile"]);
  await expect(refs.locator("h3")).toHaveCount(0);
  // No explanation under any title: the only lines are what is true of this record.
  // 41.37 — was ["Actualizat azi", "Niciun istoric înregistrat încă"]: on a record of one version the top line went
  // into „Clasificare"'s „i" bubble (the review), so the tile's only line is the history's.
  // 41.94: and since „Istoric" went, there is none at all.
  await expect(cls.locator("p:not(.sr-only)")).toHaveCount(0);
  await expect(con.locator("p:not(.sr-only)")).toHaveText([
    "Nicio etichetă adăugată încă", "Nu face parte din niciun grup", "Nicio ștampilă aplicată",
  ]);
  await expect(refs.locator("p:not(.sr-only)")).toHaveText(["Nicio trimitere adăugată încă"]);
  return { cls, con };
}

/**
 * Step 2: „Importanță"'s explanation. Inverted in place for 41.28 („one „i"") and 41.37 (the „i" on the title's line) —
 * it was: a rest on the heading „Importanță" opens its own bubble and leaving closes it. The headings have no bubble of
 * their own since 41.28; the tile's one „i" holds every explanation (TC-TILES-16 step 3b, classification-dividers).
 */
async function importanceBubble(page: Page, cls: Locator): Promise<void> {
  const info = cls.locator("[data-tile-title-line] button:has([data-info-glyph])");
  await expect(info).toHaveCount(1);
  await info.click();
  await expect(cls.locator("[data-tile-title-line] [role=tooltip]")).toContainText("Reflectă valoarea subiectivă pe care o acorzi acestui element");
  await info.click();
  await page.mouse.move(5, 5);
}

async function photograph(page: Page, kind: string, cls: Locator, con: Locator, sizes: Record<string, unknown>): Promise<void> {
  for (const width of [1366, 1920]) {
    // Tall enough for both tiles whole.
    await page.setViewportSize({ width, height: 1400 });
    await page.waitForTimeout(300);
    await cls.screenshot({ path: `${SHOTS}/after-${kind}-classification-${width}.png` });
    await con.screenshot({ path: `${SHOTS}/after-${kind}-connections-${width}.png` });
    const [a, b] = [await cls.boundingBox(), await con.boundingBox()];
    sizes[`${kind}-${width}`] = { classification: [a?.width, a?.height], connections: [b?.width, b?.height] };
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-TILES-08 — META INFO în două", () => {
  test("„Clasificări” și „Conexiuni” pe cele patru ecrane, explicațiile în bule", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids = {
      property: await createProperty(page.request, { nickname: `${MARK} Teren de test` }),
      document: await createDocumentOfType(page.request, "ADEVERINTA", `${MARK} Act de test`),
      person:   await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" }),
      company:  await createCompany(page.request, { name: `${MARK} Firmă de test SRL` }),
    };
    const sizes: Record<string, unknown> = {};
    try {
      // Step 1 — the property with `?tab=metadata`: the two tiles, no „META INFO", no explanation.
      const { cls, con } = await twoTiles(page, `/properties/${ids.property}?tab=metadata`);
      await photograph(page, "property", cls, con, sizes);

      // Step 2 — „Importanță"'s bubble.
      await importanceBubble(page, cls);

      // Step 3 — Proveniență's value, „Manual (Adaugă nou)", and what it means. 41.10: read as text, not a select.
      const provenance = cls.locator('[data-read-value="classification.provenance"]');
      await expect(provenance).toHaveText("Manual (Adaugă nou)");
      const meaning = cls.getByRole("tooltip").filter({ hasText: "Acest element a fost introdus manual" });
      await expect(meaning).toHaveClass(/sr-only/);
      await provenance.hover();
      await expect(meaning).not.toHaveClass(/sr-only/);
      await page.mouse.move(5, 5);
      await expect(meaning).toHaveClass(/sr-only/);

      // Step 4 — the document, the natural person and the company the same way.
      const doc = await twoTiles(page, `/documents/${ids.document}?tab=metadata`);
      await photograph(page, "document", doc.cls, doc.con, sizes);
      await importanceBubble(page, doc.cls);
      for (const url of [`/natural-persons/${ids.person}?tab=metadata`, `/judicial-persons/${ids.company}?tab=metadata`]) {
        const other = await twoTiles(page, url);
        await importanceBubble(page, other.cls);
      }
      fs.writeFileSync(`${SHOTS}/after.json`, JSON.stringify(sizes, null, 2));
    } finally {
      await removeRecord(page.request, "property", ids.property);
      await removeRecord(page.request, "document", ids.document);
      await removeRecord(page.request, "person", ids.person);
      await removeRecord(page.request, "company", ids.company);
    }
  });
});

// Slice 41.96 — Adrian: „The name of the item for all principal objects types will be in line with the type of principal
// object … the remove button … will become a bubble - that shows at mouse hover over the type of principal object … the
// icon of the principal object will be added at the front of the principal object type … The colour of the icon will
// follow the existing convention". On two invented persons, the second with a long name.
test.describe("TC-TILES-08 (41.96) — „Alte referințe”: iconița, numele pe același rând, „×” pe tipul obiectului", () => {
  test("iconița în culoarea tipului, numele lung lângă dreptunghi, „×” pe colțul lui la mouse", async ({ page }) => {
    test.slow();
    const M = `${MARK}-REF`;
    await removeLeftovers(page.request, M);
    await page.setViewportSize({ width: 1366, height: 900 });
    const one = await createNaturalPerson(page.request, { lastName: M, firstName: "Ion" });
    const two = await createNaturalPerson(page.request, { lastName: `${M} Popescu-Ionescu-Vasilescu-Georgescu`, firstName: "Maria-Magdalena Alexandra" });
    try {
      const po = ((await (await page.request.get(`/api/people/${one}/entity-references`)).json()) as { principalObjectId: string }).principalObjectId;
      const twoCode = ((await (await page.request.get(`/api/people/${two}`)).json()) as { person: { code: string } }).person.code;
      expect((await page.request.post(`/api/metadata/${po}/cross-refs`, { data: { targetCode: twoCode } })).ok()).toBeTruthy();
      await page.goto(`/natural-persons/${one}?tab=metadata`);
      const refs = page.getByRole("region", { name: REFERENCES, exact: true });
      const row = refs.locator("[data-reference-row]").first();
      await expect(row).toBeVisible({ timeout: 30_000 });
      const kind = row.locator('[data-reference-kind="natural"]');
      await expect(kind).toHaveText("Persoană");
      // The icon first, in the natural person's colour (#5A2781).
      const icon = kind.locator("svg[data-kind-icon]");
      await expect(icon).toHaveAttribute("data-kind-icon", "natural");
      await expect(icon).toHaveCSS("color", "rgb(90, 39, 129)");
      // The long name beside the rectangle, never under it.
      const [kb, nb] = await Promise.all([kind.boundingBox(), row.locator("[data-reference-name]").boundingBox()]);
      expect(nb!.x, "beside the rectangle").toBeGreaterThanOrEqual(kb!.x + kb!.width);
      expect(nb!.y, "on its line").toBeLessThan(kb!.y + kb!.height);
      // In edit, the „×" on the rectangle's corner under the pointer; none at the row's right.
      await refs.locator('[data-tile-edit="otherReferences"]').click();
      const remove = row.getByRole("button", { name: "Elimină trimiterea", exact: true });
      await expect(remove).toHaveCount(1);
      await page.mouse.move(2, 2);
      const opacity = () => remove.evaluate((b) => Number(getComputedStyle(b.parentElement as HTMLElement).opacity));
      await expect.poll(opacity).toBe(0);
      await kind.locator("> span").first().hover();
      await expect.poll(opacity).toBe(1);
      const [xb, rb] = await Promise.all([remove.boundingBox(), kind.locator("> span").first().boundingBox()]);
      expect(xb!.x + xb!.width).toBeGreaterThan(rb!.x + rb!.width - 4);
      expect(xb!.x).toBeLessThan(rb!.x + rb!.width + 16);
      expect(xb!.y).toBeLessThan(rb!.y + 4);
    } finally {
      await removeRecord(page.request, "person", one);
      await removeRecord(page.request, "person", two);
    }
  });
});
