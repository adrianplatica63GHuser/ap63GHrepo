/**
 * Case:   TC-DOC-07 — Cota-parte doar pentru rolurile care dețin o cotă: un PAD cu un Proiectant, un CVC cu un Vânzător
 * Source: docs/testing/cases/TC-DOC-07.md, „Last green" 2026-10-02
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-DOC-07` (records.ts); the two links are
 *     posted through POST /api/documents/[id]/persons, as „Asociază" does.
 *   - „Deține cotă" on the PAD's „Proiectant / Consultant" is set to the
 *     case's „Before you start" (off, as migration_091 left it) through the
 *     PATCH the tick calls — before the steps, and again in `finally` once the
 *     page's own requests have settled — so neither an interrupted run nor a
 *     tick still in flight leaves it on.
 *   - Slice #37.59's pictures, not steps of the case: the PAD's and the
 *     CVC's „Persoane" and „Roluri pe Document", at 1366 and 1920 px, into
 *     `playwright-report/role-share/`.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  E2E_MARKER,
  createDocumentOfType,
  createNaturalPerson,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}DOC-07`;
const PERSON = `Ion ${MARK}`;
const SHOTS = "playwright-report/role-share";

type Pair = { id: string; documentTypeId: string; personRoleId: string; personRoleName: string; documentTypeName: string; holdsShare: boolean };

async function pairs(page: Page): Promise<Pair[]> {
  const res = await page.request.get("/api/admin/doc-type-person-roles");
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { items: Pair[] }).items;
}

async function setHoldsShare(page: Page, id: string, holdsShare: boolean): Promise<void> {
  const res = await page.request.patch(`/api/admin/doc-type-person-roles/${id}`, { data: { holdsShare } });
  expect(res.status()).toBe(204);
}

async function link(page: Page, documentId: string, personId: string, personRoleId: string): Promise<void> {
  const res = await page.request.post(`/api/documents/${documentId}/persons`, { data: { personIds: [personId], personRoleId } });
  expect(res.ok(), `POST persons failed (${res.status()})`).toBeTruthy();
}

/** The person's row on „Persoane": how many share boxes it draws, and whether they are editable. */
async function personsRow(page: Page, documentId: string): Promise<Locator> {
  await page.goto(`/documents/${documentId}`);
  const tile = await showTile(page, "Persoane");
  const row = tile.locator("tbody tr").filter({ hasText: PERSON });
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  return row;
}

const boxes = (row: Locator) => row.locator('input[type="text"], select');

async function openRolesScreen(page: Page): Promise<Locator> {
  await page.goto("/admin/value-lists");
  await page.getByRole("button", { name: "Tipuri de Document", exact: true }).click();
  await page.getByRole("button", { name: "Roluri pe Document", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Roluri pe Document" });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.locator("tbody tr").first()).toBeVisible({ timeout: 30_000 });
  return dialog;
}

const tick = (dialog: Locator, pair: Pair) =>
  dialog.getByRole("checkbox", { name: `Deține cotă — ${pair.documentTypeName} — ${pair.personRoleName}`, exact: true });

async function photograph(page: Page, name: string, target: Locator): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await target.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-DOC-07 — cota-parte doar pentru rolurile care dețin o cotă", () => {
  test("un Proiectant pe un PAD fără cotă, un Vânzător pe un CVC cu cotă; bifa „Deține cotă” le aduce înapoi", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });

    const all = await pairs(page);
    const proiectant = all.find((p) => p.documentTypeName === "Plan de Amplasament și Delimitare" && p.personRoleName === "Proiectant / Consultant");
    const vanzator = all.find((p) => p.documentTypeName === "Contract de Vânzare" && p.personRoleName === "Vânzător");
    expect(proiectant, "the PAD offers „Proiectant / Consultant\" (Before you start)").toBeTruthy();
    expect(vanzator, "Contract de Vânzare offers „Vânzător\" (Before you start)").toBeTruthy();
    const P = proiectant as Pair;
    const V = vanzator as Pair;
    await setHoldsShare(page, P.id, false);
    expect(V.holdsShare).toBe(true);

    const personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const padId = await createDocumentOfType(page.request, "PLAN_AMPLASAMENT_DELIMITARE", `${MARK} PAD`);
    const cvcId = await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} CVC`);
    try {
      await link(page, padId, personId, P.personRoleId);
      await link(page, cvcId, personId, V.personRoleId);

      // Step 1 — the PAD: „Proiectant / Consultant", no share boxes.
      let row = await personsRow(page, padId);
      await expect(row).toContainText("Proiectant / Consultant");
      await expect(boxes(row)).toHaveCount(0);
      await photograph(page, "pad-persons-unticked", page.getByRole("region", { name: "Persoane", exact: true }));

      // Step 2 — the CVC: „Vânzător", the three boxes, empty.
      row = await personsRow(page, cvcId);
      await expect(row).toContainText("Vânzător");
      await expect(boxes(row)).toHaveCount(3);
      for (const b of await boxes(row).all()) await expect(b).toBeEnabled();
      await expect(boxes(row).first()).toHaveValue("");
      await photograph(page, "cvc-persons", page.getByRole("region", { name: "Persoane", exact: true }));

      // Step 3 — „Roluri pe Document": Tip document · Rol persoană · Deține cotă.
      let dialog = await openRolesScreen(page);
      await expect(dialog.getByRole("columnheader", { name: "Deține cotă" })).toBeVisible();
      await expect(tick(dialog, P)).not.toBeChecked();
      await expect(tick(dialog, V)).toBeChecked();
      await photograph(page, "roles-on-document", dialog);

      // Step 4 — tick it; it stays after the screen is opened again.
      await tick(dialog, P).check();
      await expect(tick(dialog, P)).toBeChecked();
      await expect.poll(async () => (await pairs(page)).find((p) => p.id === P.id)?.holdsShare, { timeout: 15_000 }).toBe(true);
      dialog = await openRolesScreen(page);
      await expect(tick(dialog, P)).toBeChecked();

      // Step 5 — the PAD: the three boxes, empty.
      row = await personsRow(page, padId);
      await expect(boxes(row)).toHaveCount(3);
      await photograph(page, "pad-persons-ticked", page.getByRole("region", { name: "Persoane", exact: true }));

      // Step 6 — `50` into „Cotă-parte", Enter.
      const parte = row.getByRole("textbox", { name: /^Cotă-parte/ });
      await parte.fill("50");
      await parte.press("Enter");
      await expect(parte).toHaveValue("50", { timeout: 15_000 });

      // Step 7 — untick; the boxes stay, read-only, `50` kept, the hint under them.
      dialog = await openRolesScreen(page);
      await tick(dialog, P).uncheck();
      await expect(tick(dialog, P)).not.toBeChecked();
      await expect.poll(async () => (await pairs(page)).find((p) => p.id === P.id)?.holdsShare, { timeout: 15_000 }).toBe(false);
      row = await personsRow(page, padId);
      await expect(boxes(row)).toHaveCount(3);
      for (const b of await boxes(row).all()) await expect(b).toBeDisabled();
      await expect(row.getByRole("textbox", { name: /^Cotă-parte/ })).toHaveValue("50");
      await expect(row).toContainText("Rolul nu deține o cotă pe acest tip de act — valorile salvate rămân, doar de citit.");
      await photograph(page, "pad-persons-readonly", page.getByRole("region", { name: "Persoane", exact: true }));
    } finally {
      await page.waitForLoadState("networkidle").catch(() => {});
      await setHoldsShare(page, P.id, false);
      await removeRecord(page.request, "document", padId);
      await removeRecord(page.request, "document", cvcId);
      await removeRecord(page.request, "person", personId);
    }
  });
});
