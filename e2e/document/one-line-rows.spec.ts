/**
 * Case:   TC-DOC-09 — „Persoane", „Proprietăți" și „Acte corelate" pe un rând: cota-parte după butonul portocaliu, relația după butonul ei, „Înscrisuri citate" pliate
 * Source: docs/testing/cases/TC-DOC-09.md, „Last green" 2026-10-03
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-DOC-09` (records.ts); the links are posted
 *     through the routes „Asociază" calls.
 *   - The tiles are ticked with `showTile` in this browser's own profile,
 *     where the case uses `?tab=…`: the spec needs two tiles at once.
 *   - Step 3 rests the mouse with Playwright, which raises the pointer event
 *     the desktop pane could not (the case's notes).
 *   - Slice #37.64's pictures, not steps of the case: the PAD's and the CVC's
 *     three tiles, the share panel open, the relationship bubble, and
 *     „Înscrisuri citate" folded and unfolded, at 1366 and 1920 px, into
 *     `playwright-report/one-line-rows/`.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  E2E_MARKER,
  createDocumentOfType,
  createNaturalPerson,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";
import { expectOneLine, lineRow, openShare, showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}DOC-09`;
const PERSON = `Ion ${MARK}`;
const PAD = `${MARK} PAD`;
const CVC = `${MARK} CVC`;
const SHOTS = "playwright-report/one-line-rows";

type Pair = { personRoleId: string; personRoleName: string; documentTypeName: string; holdsShare: boolean };

async function post(page: Page, url: string, data: unknown): Promise<void> {
  const res = await page.request.post(url, { data });
  expect(res.ok(), `POST ${url} failed (${res.status()})`).toBeTruthy();
}

/** The page as it stands, at 1366 and 1920 px — the tile scrolled into view first. */
async function photograph(page: Page, name: string, target: Locator): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await target.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

async function open(page: Page, id: string, title: string): Promise<void> {
  await page.goto(`/documents/${id}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
}

test.describe("TC-DOC-09 — un rând pe rând, restul după butoane", () => {
  test("Proiectantul fără „Cotă”, Vânzătorul cu „Cotă” care salvează, relația după „Relația”, „Înscrisuri citate” pliate", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });

    const pairsRes = await page.request.get("/api/admin/doc-type-person-roles");
    const pairs = ((await pairsRes.json()) as { items: Pair[] }).items;
    const proiectant = pairs.find((p) => p.documentTypeName === "Plan de Amplasament și Delimitare" && p.personRoleName === "Proiectant / Consultant");
    const vanzator = pairs.find((p) => p.documentTypeName === "Contract de Vânzare" && p.personRoleName === "Vânzător");
    expect(proiectant?.holdsShare, "PAD — „Proiectant / Consultant\" holds no share (Before you start)").toBe(false);
    expect(vanzator?.holdsShare, "Contract de Vânzare — „Vânzător\" holds a share (Before you start)").toBe(true);
    const roles = ((await (await page.request.get("/api/admin/document-document-roles")).json()) as { items: { id: string; name: string }[] }).items;
    const titluAnterior = roles.find((r) => r.name === "Titlu anterior al");
    expect(titluAnterior).toBeTruthy();

    const personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const padId = await createDocumentOfType(page.request, "PLAN_AMPLASAMENT_DELIMITARE", PAD);
    const cvcId = await createDocumentOfType(page.request, "CONTRACT_VANZARE", CVC);
    try {
      await post(page, `/api/documents/${padId}/persons`, { personIds: [personId], personRoleId: proiectant?.personRoleId });
      await post(page, `/api/documents/${cvcId}/persons`, { personIds: [personId], personRoleId: vanzator?.personRoleId });
      await post(page, `/api/documents/${padId}/references`, { documentIds: [cvcId], relationshipRoleId: titluAnterior?.id });

      // Step 1 — the PAD's „Persoane": no headings, one line, no „Cotă", no box.
      await open(page, padId, PAD);
      let persons = await showTile(page, "Persoane");
      let row = lineRow(persons, PERSON);
      await expect(row).toHaveCount(1, { timeout: 30_000 });
      await expect(row.locator("[data-row-content]")).toHaveText(`${PERSON} (Proiectant / Consultant)`);
      await expectOneLine(row);
      await expect(persons.getByRole("columnheader")).toHaveCount(0);
      await expect(row.getByRole("button", { name: "Cotă", exact: true })).toHaveCount(0);
      await expect(row.locator('input[type="text"], select')).toHaveCount(0);
      await expect(row.getByRole("link", { name: "Vizualizare", exact: true })).toBeVisible();
      await expect(row.getByRole("button", { name: "Previzualizare", exact: true })).toBeVisible();
      await showTile(page, "Proprietăți");
      await showTile(page, "Acte corelate");
      await photograph(page, "pad-tiles", persons);

      // Step 2 — the CVC's „Persoane": one line, a solid orange „Cotă".
      await open(page, cvcId, CVC);
      persons = await showTile(page, "Persoane");
      row = lineRow(persons, PERSON);
      await expect(row.locator("[data-row-content]")).toHaveText(`${PERSON} (Vânzător)`, { timeout: 30_000 });
      await expectOneLine(row);
      const share = row.getByRole("button", { name: "Cotă", exact: true });
      await expect(share).toBeVisible();
      await expect(share).toHaveClass(/bg-orange-700/);

      // Step 3 — rest the mouse on „Cotă": the three values in a bubble.
      await share.hover();
      await expect(page.getByRole("tooltip").filter({ hasText: "Cotă-parte:" })).toHaveText(
        "Cotă-parte: fără cotă · Suprafață echivalentă (mp): fără suprafață · Mod de deținere: nespecificat",
      );
      await photograph(page, "cvc-tiles", persons);

      // Step 4 — „Cotă": the panel, three empty boxes, the cursor in „Cotă-parte".
      const panel = await openShare(row);
      const parte = panel.getByRole("textbox", { name: /^Cotă-parte/ });
      await expect(parte).toBeFocused();
      for (const box of await panel.getByRole("textbox").all()) await expect(box).toHaveValue("");
      await expect(panel.getByRole("combobox").locator("option:checked")).toHaveText("nespecificat");
      await photograph(page, "cvc-share-panel", persons);

      // Step 5 — `50`, Esc: closed, saved, the button an outline.
      await page.keyboard.type("50");
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(share).toHaveClass(/bg-orange-50/, { timeout: 15_000 });
      await share.hover();
      await expect(page.getByRole("tooltip").filter({ hasText: "Cotă-parte:" })).toContainText("Cotă-parte: 50 ·");

      // Step 6 — `120` into „Suprafață echivalentă (mp)", a click outside: closed, saved beside `50`.
      await openShare(row);
      const mp = panel.getByRole("textbox", { name: /^Suprafață echivalentă \(mp\)/ });
      await mp.click();
      await mp.fill("120");
      await persons.getByRole("heading", { name: "Persoane" }).click();
      await expect(panel).toHaveCount(0);
      await expect.poll(async () => {
        const res = await page.request.get(`/api/documents/${cvcId}/persons`);
        const items = ((await res.json()) as { items: { cotaParte: number | null; cotaSuprafataMp: number | null }[] }).items;
        return items.map((i) => [i.cotaParte, i.cotaSuprafataMp]);
      }, { timeout: 15_000 }).toEqual([[50, 120]]);

      // Step 7 — „Acte corelate": no headings, one line, the sentence not on the row.
      const related = await showTile(page, "Acte corelate");
      const doc = lineRow(related, PAD);
      await expect(doc.locator("[data-row-content]")).toHaveText(`${PAD} (Plan de Amplasament și Delimitare)`, { timeout: 30_000 });
      await expectOneLine(doc);
      await expect(related.getByRole("columnheader")).toHaveCount(0);
      await expect(doc).not.toContainText("acest document");
      for (const name of ["Relația", "Previzualizare"]) await expect(doc.getByRole("button", { name, exact: true })).toBeVisible();
      await expect(doc.getByRole("link", { name: "Vizualizează", exact: true })).toBeVisible();

      // Step 8 — „Relația": the sentence in a bubble beside it.
      const sentence = `${PAD} „Titlu anterior al” acest document`;
      await doc.getByRole("button", { name: "Relația", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Titlu anterior al" })).toHaveText(sentence);
      await photograph(page, "cvc-relationship", related);

      // Step 9 — Esc hides it; pressed again, a click outside hides it.
      await page.keyboard.press("Escape");
      await expect(page.getByText(sentence)).toHaveCount(0);
      await doc.getByRole("button", { name: "Relația", exact: true }).click();
      await expect(page.getByText(sentence)).toBeVisible();
      await related.getByRole("heading", { name: "Acte corelate" }).click();
      await expect(page.getByText(sentence)).toHaveCount(0);

      // Step 10 — „Asociază", „Dezasociază", „Înscrisuri citate" in one row; the panel unfolds.
      const cited = related.getByRole("button", { name: "Înscrisuri citate", exact: true });
      const associate = related.getByRole("button", { name: "Asociază", exact: true });
      const [a, c] = [await associate.boundingBox(), await cited.boundingBox()];
      expect(Math.abs((a?.y ?? 0) - (c?.y ?? 1))).toBeLessThan(2);
      await expect(cited).toHaveAttribute("aria-expanded", "false");
      await photograph(page, "cvc-cited-folded", related);
      await cited.click();
      await expect(related.getByText("Înscrisuri citate în acest document")).toBeVisible();
      await expect(related.getByText("Acest document nu a fost încă citit pentru înscrisurile pe care le citează.")).toBeVisible();
      await expect(related.getByRole("button", { name: "Verifică înscrisurile citate", exact: true })).toBeVisible();
      await expect(related.getByRole("button", { name: "Recitește documentul", exact: true })).toBeVisible();
      await photograph(page, "cvc-cited-unfolded", related);

      // Step 11 — pressed again: folded.
      await cited.click();
      await expect(related.getByText("Înscrisuri citate în acest document")).toHaveCount(0);
    } finally {
      await page.waitForLoadState("networkidle").catch(() => {});
      await removeRecord(page.request, "document", padId);
      await removeRecord(page.request, "document", cvcId);
      await removeRecord(page.request, "person", personId);
    }
  });
});
