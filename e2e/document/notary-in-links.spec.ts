/**
 * Case:   TC-DOC-29 — Notariatul ales pe „Identificarea actului” apare în „Legături”, ca „Notar”; schimbat sau golit, îl urmează
 * Source: docs/testing/cases/TC-DOC-29.md, „Last green" 2026-11-02
 *
 * Slice 41.53. Two invented notary offices (juridical persons of a public-body type) and an invented Contract de
 * Vânzare, made through the routes and removed at the end. Maps are blocked by default.
 */
import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createCompany, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";
import { editTile, saveTile, showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}DOC-29`;
const A = `${MARK} Birou A`;
const B = `${MARK} Birou B`;

async function publicBodyType(page: Page): Promise<string> {
  const res = await page.request.get("/api/admin/value-lists/judicial-person-types");
  expect(res.ok()).toBeTruthy();
  const { items } = (await res.json()) as { items: { id: string; publicBody?: boolean }[] };
  const t = items.find((i) => i.publicBody);
  expect(t, "a public-body type").toBeTruthy();
  return t!.id;
}

/** „Legături"'s juridical persons, as their rows read. */
async function juridical(page: Page): Promise<string[]> {
  const tile = page.getByRole("region", { name: "Legături", exact: true });
  const group = tile.locator('[data-related-group="judicial"]');
  if ((await group.count()) === 0) return [];
  return (await group.locator("li[data-one-line-row] [data-row-content]").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim());
}

async function chooseIssuer(page: Page, label: string): Promise<void> {
  await editTile(page, "general");
  await page.locator('[data-panel="general"]').getByRole("combobox", { name: "Notariat", exact: true }).selectOption(label === "" ? { value: "" } : { label });
  await saveTile(page, "general");
}

test.describe("TC-DOC-29 — notariatul în „Legături”", () => {
  test("ales, schimbat, golit: „Legături” îl urmează ca „Notar”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const made: [("company" | "document"), string][] = [];
    try {
      const type = await publicBodyType(page);
      made.push(["company", await createCompany(page.request, { name: A, judicialPersonTypeId: type })]);
      made.push(["company", await createCompany(page.request, { name: B, judicialPersonTypeId: type })]);
      const doc = await createSaleContract(page.request, `${MARK} CVC`);
      made.push(["document", doc]);
      await page.goto(`/documents/${doc}`);
      await showTile(page, "Legături");

      // Step 1 — „Notariat" A, „Salvează": A in „Legături", under „Persoane juridice", as „Notar".
      await chooseIssuer(page, A);
      await expect.poll(() => juridical(page), { timeout: 30_000 }).toEqual([`${A} (Notar)`]);

      // Step 2 — B instead: only B.
      await chooseIssuer(page, B);
      await expect.poll(() => juridical(page), { timeout: 30_000 }).toEqual([`${B} (Notar)`]);

      // Step 3 — „Dezasociază" on it is refused, with the sentence.
      const res = await page.request.get(`/api/documents/${doc}/persons`);
      const { items } = (await res.json()) as { items: { id: string; linkId: string; displayName?: string }[] };
      const link = items.find((i) => i.displayName === B) ?? items[0];
      const del = await page.request.delete(`/api/documents/${doc}/persons/${link.id}?linkId=${link.linkId}`);
      expect(del.status()).toBe(409);
      expect(((await del.json()) as { code: string }).code).toBe("ISSUER_LINK");

      // Step 4 — „Notariat" emptied: none.
      await chooseIssuer(page, "");
      await expect.poll(() => juridical(page), { timeout: 30_000 }).toEqual([]);
    } finally {
      for (const [kind, id] of made.reverse()) await removeRecord(page.request, kind, id);
    }
  });
});
