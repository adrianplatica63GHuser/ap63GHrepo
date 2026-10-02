/**
 * Case:   TC-DOC-02 — Un „Subiect" pe mai multe rânduri împinge „Note extinse" în jos, în vizualizare și în editare
 * Source: docs/testing/cases/TC-DOC-02.md, „Last green" 2026-10-02
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The documents carry `TC-E2E-DOC-02` (records.ts): „Etichetă scurtă"
 *     `TC-E2E-DOC-02 Act` and `TC-E2E-DOC-02 Act scurt`, with the case's two
 *     subjects. They are posted here with a „Subiect", which records.ts's
 *     helpers do not send — only this case needs one.
 *   - The hand run read the edges with a script on the page; here they are
 *     Playwright's bounding boxes of the same elements.
 *   - Slice #37.51's pictures, not steps of the case: the „Date generale" tile
 *     with the one-line and the three-line subject, at 1366 and 1920 px, into
 *     `playwright-report/subject-grows/`.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, documentTypeIdFor, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-02`;
const LONG_TITLE = `${MARK} Act`;
const SHORT_TITLE = `${MARK} Act scurt`;
const SUBJECT =
  "Vânzarea terenului din tarlaua 40, parcela 212, cu toate construcțiile de pe el, către cumpărătorul din contract, " +
  "cu plata prețului în trei tranșe egale, la datele stabilite de părți în actul autentic";
const TYPED = ", cu cheltuielile suportate de cumpărător";
const SHOTS = "playwright-report/subject-grows";

async function createDocument(page: Page, title: string, subject: string): Promise<string> {
  const documentTypeId = await documentTypeIdFor(page.request, "CONTRACT_VANZARE");
  const res = await page.request.post("/api/documents", { data: { documentTypeId, title, subject, provenance: "MANUAL" } });
  expect(res.ok(), `POST /api/documents failed (${res.status()})`).toBeTruthy();
  return ((await res.json()) as { id: string }).id;
}

const box = (page: Page, field: string) => page.locator(`[data-width-field="${field}"]`);
const labelOf = (page: Page, field: string) => page.locator("label").filter({ has: box(page, field) });

async function edges(l: Locator): Promise<{ top: number; bottom: number }> {
  const b = await l.boundingBox();
  expect(b).not.toBeNull();
  return { top: b!.y, bottom: b!.y + b!.height };
}

/** The box's rendered lines: content height over line height. */
async function lines(l: Locator): Promise<number> {
  return l.evaluate((el) => {
    const t = el as HTMLTextAreaElement;
    const cs = getComputedStyle(t);
    return Math.round((t.scrollHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight));
  });
}

/** „Above": the bottom of `upper` at or above the top of `lower` (half a pixel of rounding). */
async function expectAbove(upper: Locator, lower: Locator): Promise<void> {
  expect((await edges(upper)).bottom).toBeLessThanOrEqual((await edges(lower)).top + 0.5);
}

async function expectInOrder(page: Page, subjectLines: number): Promise<void> {
  await expect(box(page, "subject")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => lines(box(page, "subject"))).toBe(subjectLines);
  await expectAbove(box(page, "subject"), labelOf(page, "notes"));
  await expectAbove(box(page, "title"), labelOf(page, "subject"));
  const tile = page.locator("section").filter({ has: box(page, "subject") });
  expect((await edges(box(page, "notes"))).bottom).toBeLessThanOrEqual((await edges(tile)).bottom + 0.5);
}

async function photograph(page: Page, name: string): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.waitForTimeout(300);
    await page.locator("section").filter({ has: box(page, "subject") }).screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-DOC-02 — „Subiect” pe mai multe rânduri împinge „Note extinse” în jos", () => {
  test("în vizualizare, în editare, și cu un rând în plus tastat", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const made: string[] = [];
    try {
      const longId = await createDocument(page, LONG_TITLE, SUBJECT);
      made.push(longId);
      const shortId = await createDocument(page, SHORT_TITLE, "Vânzare teren");
      made.push(shortId);

      // Step 1 — read-only: three lines, nothing over anything, „Note extinse" inside the tile.
      await page.goto(`/documents/${longId}?readonly=true`);
      await expect(box(page, "subject")).toBeDisabled({ timeout: 30_000 });
      await expectInOrder(page, 3);
      await photograph(page, "general-three-lines");

      // Step 2 — for editing: the same.
      await page.goto(`/documents/${longId}`);
      await expect(box(page, "subject")).toBeEditable({ timeout: 30_000 });
      await expectInOrder(page, 3);
      const before = await edges(labelOf(page, "notes"));

      // Step 3 — typed at the end: four lines, „Note extinse" moved down, the tile grown.
      await box(page, "subject").click();
      await page.keyboard.press("Control+End");
      await page.keyboard.type(TYPED);
      await expect(box(page, "subject")).toHaveValue(SUBJECT + TYPED);
      await expectInOrder(page, 4);
      expect((await edges(labelOf(page, "notes"))).top).toBeGreaterThan(before.top);

      // Step 4 — the short one: one line, above „Note extinse".
      // A full navigation: the app asks about unsaved changes only on its own links.
      await page.goto(`/documents/${shortId}`);
      await expectInOrder(page, 1);
      await photograph(page, "general-one-line");
    } finally {
      // At the end — leaving without saving, then deleting both documents.
      for (const id of made) await removeRecord(page.request, "document", id);
    }
  });
});
