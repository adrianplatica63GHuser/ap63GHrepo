/**
 * Case:   TC-TILES-12 — Fiecare fișă chiar sub fișa de deasupra ei; previzualizarea chiar sub fișa din care a fost deschisă
 * Source: docs/testing/cases/TC-TILES-12.md, „Last green" 2026-10-04
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-12` (records.ts).
 *   - The runner's page is visible, so the row settles by itself once the
 *     lists have loaded: no tile is unticked and re-ticked to lay it out
 *     afresh, as the hidden pane needed. Each reading is polled until it holds.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { hideTile, showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-12`;
const GAP = 16;

type Pair = { personRoleId: string; personRoleName: string; documentTypeName: string };
type Box = { l: number; t: number; r: number; b: number };

async function post(page: Page, url: string, data: unknown): Promise<void> {
  const res = await page.request.post(url, { data });
  expect(res.ok(), `POST ${url} failed (${res.status()})`).toBeTruthy();
}

async function boxOf(l: Locator): Promise<Box> {
  const r = await l.boundingBox();
  if (!r) throw new Error("not on the page");
  return { l: Math.round(r.x), t: Math.round(r.y), r: Math.round(r.x + r.width), b: Math.round(r.y + r.height) };
}

/** Every packed box of the row, and the pairs that overlap. */
async function overlapsIn(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const boxes = [...document.querySelectorAll<HTMLElement>("[data-packed-col]")].map((e) => {
      const r = e.getBoundingClientRect();
      return { id: e.dataset.tile ?? e.dataset.panel ?? "actions", l: r.left, t: r.top, r: r.right, b: r.bottom };
    });
    const out: string[] = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i], boxes[j]];
        if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) out.push(`${a.id}×${b.id}`);
      }
    return out;
  });
}

/** The form's buttons (`order-last basis-full`), as the row placed them. */
const actionBar = (page: Page) => page.locator("[data-tile-row] [data-packed-col].order-last");

/** Every packed box but the action bar and the previews: its `left` and `top`. */
async function places(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-packed-col]")]
      .filter((e) => !e.classList.contains("order-last") && !e.hasAttribute("data-preview"))
      .map((e) => `${e.dataset.tile ?? e.dataset.panel} ${e.style.left} ${e.style.top}`));
}

test.describe("TC-TILES-12 — fiecare fișă chiar sub fișa de deasupra ei", () => {
  test("„Clasificare subiectivă” sub „Adresă domiciliu”; previzualizarea sub „Corelate”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1200 });
    const pairs = ((await (await page.request.get("/api/admin/doc-type-person-roles")).json()) as { items: Pair[] }).items;
    const seller = pairs.find((p) => p.documentTypeName === "Contract de Vânzare" && p.personRoleName === "Vânzător");
    expect(seller, "Contract de Vânzare offers „Vânzător\"").toBeTruthy();
    const person = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const company = await createCompany(page.request, { name: `${MARK} Firmă SRL` });
    const docs: string[] = [];
    for (let i = 1; i <= 12; i++) docs.push(await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} Contract ${i}`));
    try {
      for (const d of docs) await post(page, `/api/documents/${d}/persons`, { personIds: [person], personRoleId: seller?.personRoleId });
      await post(page, `/api/documents/${docs[0]}/persons`, { personIds: [company], personRoleId: seller?.personRoleId });

      // Step 1 — the person; „Toate": every tile, „Corelate" with the twelve contracts.
      await page.goto(`/natural-persons/${person}`);
      await page.getByRole("button", { name: "Toate", exact: true }).click({ timeout: 30_000 });
      const region = (name: string) => page.getByRole("region", { name, exact: true });
      await expect(region("Conexiuni")).toBeVisible({ timeout: 30_000 });
      await expect(region("Corelate").locator("li")).toHaveCount(12, { timeout: 30_000 });

      // Step 2 — each box right under the box above it.
      const home = page.locator('[data-panel="addresses.HOME"]');
      const corr = page.locator('[data-panel="addresses.CORRESPONDENCE"]');
      await expect.poll(async () => {
        const [identity, idCard, contact, h, c, related, cls, conn] = await Promise.all([
          boxOf(region("Identitate")), boxOf(region("Carte de identitate")), boxOf(region("Contact")),
          boxOf(home), boxOf(corr), boxOf(region("Corelate")), boxOf(region("Clasificare subiectivă")), boxOf(region("Conexiuni")),
        ]);
        return {
          firstLine: new Set([identity.t, idCard.t, contact.t]).size,
          homeUnderIdentity: h.t - identity.b,
          corrUnderIdCard: c.t - idCard.b,
          relatedUnderContact: related.t - contact.b,
          clsUnderHome: cls.t - h.b,
          connUnderCorr: conn.t - c.b,
          aboveRelatedBottom: cls.t < related.b && conn.t < related.b,
        };
      }, { timeout: 20_000 }).toEqual({
        firstLine: 1, homeUnderIdentity: GAP, corrUnderIdCard: GAP, relatedUnderContact: GAP, clsUnderHome: GAP, connUnderCorr: GAP, aboveRelatedBottom: true,
      });
      expect(await overlapsIn(page)).toEqual([]);
      const lowest = await page.evaluate(() => Math.max(...[...document.querySelectorAll<HTMLElement>("[data-packed-col]")]
        .filter((e) => !e.classList.contains("order-last")).map((e) => Math.round(e.getBoundingClientRect().bottom))));
      expect((await boxOf(actionBar(page))).t - lowest).toBe(GAP);

      // Step 3 — the company: „Corelate" and „Clasificare subiectivă", not „Conexiuni".
      await page.goto(`/judicial-persons/${company}`);
      const related = await showTile(page, "Corelate");
      const cls = await showTile(page, "Clasificare subiectivă");
      await hideTile(page, "Conexiuni");
      await expect(related.locator("li")).toHaveCount(1, { timeout: 30_000 });
      await expect.poll(async () => {
        const [r, c] = await Promise.all([boxOf(related), boxOf(cls)]);
        return c.b - c.t > r.b - r.t;
      }, { timeout: 20_000 }).toBe(true);

      // Step 4 — „Previzualizare" on Contract 1: right under „Corelate".
      await related.locator("li").getByRole("button", { name: "Previzualizare", exact: true }).click();
      const preview = page.locator("[data-preview]");
      await expect(preview.locator("h2")).toHaveText(`${MARK} Contract 1`, { timeout: 30_000 });
      await expect.poll(async () => {
        const [p, r, c, bar] = await Promise.all([boxOf(preview), boxOf(related), boxOf(cls), boxOf(actionBar(page))]);
        return { underRelated: p.t - r.b, sameLeft: p.l === r.l, aboveClsBottom: p.t < c.b, barUnder: bar.t - p.b };
      }, { timeout: 20_000 }).toEqual({ underRelated: GAP, sameLeft: true, aboveClsBottom: true, barUnder: GAP });
      expect(await overlapsIn(page)).toEqual([]);
      const before = await places(page);

      // Step 5 — „Închide": the preview gone, every other box where it was.
      await preview.getByRole("button", { name: "Închide", exact: true }).click();
      await expect(preview).toHaveCount(0);
      expect(await places(page)).toEqual(before);
    } finally {
      for (const d of docs) await removeRecord(page.request, "document", d);
      await removeRecord(page.request, "company", company);
      await removeRecord(page.request, "person", person);
    }
  });
});
