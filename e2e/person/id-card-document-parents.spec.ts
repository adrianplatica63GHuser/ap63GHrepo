/**
 * Case:   TC-PERS-10 — „Creează persoane din CI” pe o carte de identitate din arhivă: titularul legat de act, apoi tatăl și mama
 * Source: docs/testing/cases/TC-PERS-10.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step (Slice #38.44). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The card is the drawn one, `e2e/fixtures/tc-e2e-imp-05-carte.jpg`,
 *     uploaded as the page of a TC-E2E- Carte de identitate made through the
 *     API.
 *   - THE READ IS ANSWERED HERE, NOT BY THE MODEL. `extract-id-card` is
 *     fulfilled with what the hand run of TC-IMP-05 read off the same card
 *     (as the route hands it on: names in their usual case),
 *     so every full run does not buy a vision call, and so a second test can
 *     answer it with no parents at all (Ask first 2). The real read is
 *     TC-IMP-05's.
 *   - Everything named TC-E2E-IMP-05 is removed in `finally`.
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}IMP-05`;
const CARD = path.join(__dirname, "..", "fixtures", "tc-e2e-imp-05-carte.jpg");
const HOLDER = `Andrei ${MARK}`;
const FATHER = `Ion ${MARK}`;
const MOTHER = `Maria ${MARK}`;

/** What the card reads as — TC-IMP-05's hand run of the same image. */
function reading(parents: { father: string | null; mother: string | null }) {
  return {
    fields: {
      lastName: MARK,
      firstName: "Andrei",
      cnp: "1800101420096",
      gender: "MALE",
      idSeries: "TC",
      idNumber: "990005",
    },
    lowConfidenceFields: [],
    unmappedRaw: {},
    lookupUnavailable: false,
    parents,
  };
}

async function cardDocument(page: Page): Promise<string> {
  const id = await createDocumentOfType(page.request, "CARTE_IDENTITATE", `${MARK} CI`);
  const up = await page.request.post(`/api/documents/${id}/pages`, {
    multipart: { file: { name: "tc-e2e-imp-05-carte.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(CARD) }, pageNumber: "1" },
  });
  expect(up.ok()).toBeTruthy();
  return id;
}

async function personIdNamed(page: Page, name: string): Promise<string> {
  const res = await page.request.get(`/api/admin/global-search?search=${encodeURIComponent(name)}`);
  const body = (await res.json()) as { results: { entityId: string; displayName: string }[] };
  const row = body.results.find((r) => r.displayName === name);
  expect(row, `no person named ${name}`).toBeTruthy();
  return row!.entityId;
}

async function relatedRows(page: Page): Promise<string[]> {
  const tile = await showTile(page, "Legături");
  const rows = tile.locator("[data-related-group] li[data-one-line-row] [data-row-content]");
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  return (await rows.allInnerTexts()).map((s) => s.trim());
}

test.describe("TC-PERS-10 — „Creează persoane din CI” pe ecranul actului", () => {
  test("titularul legat de act ca „Titular act de identitate”, tatăl și mama legați de el", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 900 });
    await removeLeftovers(page.request, MARK);
    let documentId: string | undefined;
    try {
      documentId = await cardDocument(page);
      await page.route("**/api/admin/import/extract-id-card", (route) =>
        route.fulfill({ json: reading({ father: "Ion", mother: "Maria" }) }),
      );

      // Step 1 — the card's screen: „Creează persoane din CI".
      await page.goto(`/documents/${documentId}`);
      const action = page.getByRole("button", { name: "Creează persoane din CI", exact: true });
      await expect(action).toBeVisible({ timeout: 30_000 });

      // Step 2 — the dialog: the holder, and both parents ticked with the holder's surname.
      await action.click();
      const fold = page.locator("[data-parents-fold]");
      await expect(fold.getByRole("checkbox", { name: "Creează și tatăl" })).toBeChecked({ timeout: 60_000 });
      await expect(fold.getByRole("checkbox", { name: "Creează și mama" })).toBeChecked();
      await expect(fold.getByLabel("Prenumele tatălui", { exact: true })).toHaveValue("Ion");
      await expect(fold.getByLabel("Numele mamei", { exact: true })).toHaveValue(MARK);

      // Step 3 — „Creează și leagă" for the holder, then for each parent.
      await page.getByRole("button", { name: "Creează și leagă", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Tatăl titularului" })).toBeVisible({ timeout: 30_000 });
      await dialog.getByRole("button", { name: "Creează și leagă", exact: true }).click();
      await expect(dialog.getByRole("heading", { name: "Mama titularului" })).toBeVisible({ timeout: 30_000 });
      await dialog.getByRole("button", { name: "Creează și leagă", exact: true }).click();
      const done = page.locator("[data-id-card-people-done]");
      await expect(done).toContainText("Titularul a fost creat și legat de act.", { timeout: 30_000 });
      await expect(done).toContainText("Tatăl: creat(ă) și legat(ă)");
      await expect(done).toContainText("Mama: creat(ă) și legat(ă)");

      // Step 4 — the holder is linked to the card as „Titular act de identitate", and to nothing else.
      const persons = (await (await page.request.get(`/api/documents/${documentId}/persons`)).json()) as {
        items?: { name?: string; displayName?: string; roleName?: string | null }[];
      };
      const linked = (persons.items ?? []).map((p) => [p.displayName ?? p.name, p.roleName ?? null]);
      expect(linked).toEqual([[HOLDER, "Titular act de identitate"]]);

      // Step 5 — the holder's „Legături": the father, the mother, the card.
      const holderId = await personIdNamed(page, HOLDER);
      await page.goto(`/natural-persons/${holderId}`);
      await expect(page.getByRole("heading", { name: HOLDER })).toBeVisible({ timeout: 30_000 });
      const rows = await relatedRows(page);
      expect(rows).toEqual(expect.arrayContaining([`${FATHER} (Tată)`, `${MOTHER} (Mamă)`]));
    } finally {
      await removeLeftovers(page.request, MARK);
      if (documentId) await removeRecord(page.request, "document", documentId);
    }
  });

  test("a card that names no parents still offers both, empty, to type", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await removeLeftovers(page.request, MARK);
    let documentId: string | undefined;
    try {
      documentId = await cardDocument(page);
      await page.route("**/api/admin/import/extract-id-card", (route) =>
        route.fulfill({ json: reading({ father: null, mother: null }) }),
      );
      await page.goto(`/documents/${documentId}`);
      await page.getByRole("button", { name: "Creează persoane din CI", exact: true }).click({ timeout: 30_000 });
      const fold = page.locator("[data-parents-fold]");
      const father = fold.getByRole("checkbox", { name: "Creează și tatăl" });
      await expect(father).not.toBeChecked({ timeout: 60_000 });
      await expect(fold.getByRole("checkbox", { name: "Creează și mama" })).not.toBeChecked();
      await expect(fold.getByLabel("Prenumele tatălui", { exact: true })).toHaveValue("");
      await expect(fold).toContainText("Cartea nu tipărește prenumele părinților");
      // Nothing is written: „Închide".
      await page.getByRole("button", { name: "Închide", exact: true }).first().click();
    } finally {
      await removeLeftovers(page.request, MARK);
      if (documentId) await removeRecord(page.request, "document", documentId);
    }
  });
});
