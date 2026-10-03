/**
 * Case:   TC-ASSOC-12 — Defunctul și moștenitorul adăugați ca părți pe un Certificat de Moștenitor
 * Source: docs/testing/cases/TC-ASSOC-12.md, „Last green" 2026-09-26
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * FU-224 (fixed in Slice #37.07): the quality — „Defunct", „Moștenitor" — is
 * shown in the certificate's „Persoane" and in each person's „Acte", under
 * „Rol", where it read „—" before. The assertions marked FU-224 say so.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The two people and the certificate are made through the POST routes the
 *     „Adaugă" forms send (e2e/helpers/records.ts), named `TC-E2E-ASSOC-12 …`.
 *   - The person table's radios are found within the row of the person, by
 *     row: the case picks by name and so does this.
 *   - The case's cleanup runs at the end; a `finally` removes all three records
 *     through the DELETE routes „Șterge" calls, which also drop the parties.
 *   - Slice #37.17: a Natural Person has no tab row; the person's „Acte"
 *     is a tile, ticked with `showTile` (e2e/helpers/tiles.ts) where the hand
 *     run clicks the tile's checkbox.
 *   - Slice #37.20: nor has the certificate. Step 2 reads its tile row („Date
 *     generale" ticked, and „Părți" — the parties panel, offered on a
 *     Certificat de Moștenitor only — ticked by default, as the panel was
 *     shown); its „Persoane" is a tile, ticked with `showTile`. „Părți" is
 *     found as the panel's heading, since the checkbox carries the same word.
 *   - Slice #37.64: a Document's „Persoane", „Proprietăți" and „Acte corelate"
 *     are one line a row with no heading row, the share boxes behind the row's
 *     orange „Cotă" (step 7 as corrected on 2026-10-03).
 *   - Slice #37.65: a Document's „Persoane", „Proprietăți" and „Acte corelate"
 *     are one tile, „Corelate", with „Asociază persoană", „Asociază
 *     proprietate" and „Asociază act" (the case's steps as corrected on 2026-10-03).
 */

import { test, expect, type Page } from "@playwright/test";
import {
  E2E_MARKER,
  createDocumentOfType,
  createNaturalPerson,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";
import { lineRow, showTile, tileBox } from "../helpers/tiles";

const MARK = `${E2E_MARKER}ASSOC-12`;
const DECEASED = `Vasile ${MARK} Defunct`;
const HEIR = `Maria ${MARK} Mostenitor`;
const CERTIFICATE = `${MARK} Certificat de test`;

/**
 * „+ Adaugă parte" is a button that navigates once the page is interactive; a
 * press the moment the certificate renders can do nothing, and the screen it
 * opens compiles on first request under `next dev` (the first runner run,
 * 20260927T004011Z-17430, sat 30 s on the certificate). So it is pressed until
 * the screen changes, for up to 90 s.
 */
async function openAddParty(page: Page, documentId: string) {
  await expect(async () => {
    if (/associate-party$/.test(page.url())) return;
    await page.getByRole("button", { name: "+ Adaugă parte" }).click({ timeout: 5_000 });
    await expect(page).toHaveURL(new RegExp(`/documents/${documentId}/associate-party$`), { timeout: 15_000 });
  }).toPass({ timeout: 90_000 });
}

/** On „Adaugă parte la certificat": pick the person, the quality, „Adaugă parte". */
async function pickParty(page: Page, documentId: string, person: string, quality: "Defunct" | "Moștenitor") {
  await page.getByPlaceholder("Nume…", { exact: true }).fill(MARK);
  const row = page.getByRole("row").filter({ hasText: person });
  await expect(row).toHaveCount(1, { timeout: 15_000 });
  await row.getByRole("radio").check();
  await expect(page.getByText("Selectați calitatea (Defunct sau Moștenitor)")).toBeVisible();
  await page.getByRole("button", { name: quality, exact: true }).click();
  await page.getByRole("button", { name: "Adaugă parte", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/documents/${documentId}$`), { timeout: 30_000 });
}

test.describe("TC-ASSOC-12 — Defunctul și moștenitorul adăugați ca părți pe un Certificat de Moștenitor", () => {
  test("două părți cu calitatea lor în „Părți”; legătura văzută din ambele capete", async ({ page }) => {
    // Room for a first-request compile of the screen it opens (below) and for the `finally`.
    test.setTimeout(240_000);
    await removeLeftovers(page.request, MARK);
    const deceasedId = await createNaturalPerson(page.request, { lastName: `${MARK} Defunct`, firstName: "Vasile" });
    const heirId = await createNaturalPerson(page.request, { lastName: `${MARK} Mostenitor`, firstName: "Maria" });
    const documentId = await createDocumentOfType(page.request, "CERTIFICAT_MOSTENITOR", CERTIFICATE);

    try {
      // Step 2 — the certificate: „Detalii", after „Pagini" a section „Părți",
      // „Nicio parte adăugată" and „+ Adaugă parte".
      await page.goto(`/documents/${documentId}`);
      await expect(page.getByRole("heading", { name: CERTIFICATE })).toBeVisible({ timeout: 30_000 });
      await expect(tileBox(page, "Date generale")).toBeChecked({ timeout: 30_000 });
      await expect(tileBox(page, "Părți")).toBeChecked({ timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Părți", exact: true })).toBeVisible({ timeout: 30_000 });
      // The panel draws its title before its list answers; under load (full
      // 20260928T233256Z-25761) the list took longer than the default 5 s.
      await expect(page.getByText("Nicio parte adăugată")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "+ Adaugă parte" })).toBeVisible();

      // Step 3 — „+ Adaugă parte": the screen, the title, „Nume" / „Cod", Cod · Nume · Tip with a
      // radio per row, a pager, „Calitate" with „Defunct" / „Moștenitor", „Selectați o persoană".
      await openAddParty(page, documentId);
      await expect(page.getByRole("heading", { name: "Adaugă parte la certificat" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(CERTIFICATE).first()).toBeVisible();
      await expect(page.getByPlaceholder("Nume…", { exact: true })).toBeVisible();
      await expect(page.getByPlaceholder("Cod…", { exact: true })).toBeVisible();
      for (const col of ["Nume", "Tip"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      await expect(page.locator("tbody input[type=checkbox]")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Următor" })).toBeVisible();
      await expect(page.getByText("Calitate", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Defunct", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Moștenitor", exact: true })).toBeVisible();
      await expect(page.getByText("Selectați o persoană", { exact: true })).toBeVisible();

      // Steps 4–5 — the deceased (the hint asks for the quality), „Defunct", „Adaugă parte":
      // back on „Detalii", „Părți" is Nume · Calitate, one row, „Elimină".
      await pickParty(page, documentId, DECEASED, "Defunct");
      const parties = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Calitate" }) });
      await expect(parties.locator("tbody tr")).toHaveCount(1, { timeout: 15_000 });
      await expect(parties.locator("tbody tr").first()).toContainText(DECEASED);
      await expect(parties.locator("tbody tr").first()).toContainText("Defunct");
      await expect(parties.getByRole("button", { name: "Elimină" })).toHaveCount(1);

      // Step 6 — „+ Adaugă parte" again, the heir, „Moștenitor": two rows, the newest first.
      await openAddParty(page, documentId);
      await pickParty(page, documentId, HEIR, "Moștenitor");
      await expect(parties.locator("tbody tr")).toHaveCount(2, { timeout: 15_000 });
      await expect(parties.locator("tbody tr").nth(0)).toContainText(HEIR);
      await expect(parties.locator("tbody tr").nth(0)).toContainText("Moștenitor");
      await expect(parties.locator("tbody tr").nth(1)).toContainText(DECEASED);
      await expect(parties.locator("tbody tr").nth(1)).toContainText("Defunct");

      // Step 7 — „Persoane": both people, „Rol" says each one's quality (FU-224).
      // Slice #37.20: „Părți" stays on screen beside the „Persoane" tile, and
      // both list the two people — so the rows are looked for in the tile.
      const personsTile = await showTile(page, "Corelate");
      for (const [person, quality] of [[DECEASED, "Defunct"], [HEIR, "Moștenitor"]] as const) {
        const r = lineRow(personsTile, person);
        await expect(r).toHaveCount(1, { timeout: 15_000 });
        await expect(r.locator("[data-row-content]")).toHaveText(`${person} (${quality})`); // FU-224, „Nume (Rol)" since #37.64
      }
      await expect(personsTile.getByRole("columnheader")).toHaveCount(0);

      // Step 8 — each person's „Acte": „Certificat de Moștenitor", the title, the quality (FU-224).
      for (const [id, person, quality] of [[heirId, HEIR, "Moștenitor"], [deceasedId, DECEASED, "Defunct"]] as const) {
        await page.goto(`/natural-persons/${id}`);
        await expect(page.getByRole("heading", { name: person })).toBeVisible({ timeout: 30_000 });
        await showTile(page, "Acte");
        const r = page.getByRole("row").filter({ hasText: CERTIFICATE });
        await expect(r).toHaveCount(1, { timeout: 15_000 });
        await expect(r).toContainText("Certificat de Moștenitor");
        await expect(r.getByRole("cell", { name: quality, exact: true })).toHaveCount(1); // FU-224
      }

      // ── At the end — „Elimină" on each row, no question, no „Salvează"; still gone after a reload ──
      await page.goto(`/documents/${documentId}`);
      await expect(parties.locator("tbody tr")).toHaveCount(2, { timeout: 30_000 });
      await parties.getByRole("button", { name: "Elimină" }).first().click();
      await expect(parties.locator("tbody tr")).toHaveCount(1, { timeout: 15_000 });
      await parties.getByRole("button", { name: "Elimină" }).first().click();
      await expect(page.getByText("Nicio parte adăugată")).toBeVisible({ timeout: 15_000 });
      await page.reload();
      await expect(page.getByText("Nicio parte adăugată")).toBeVisible({ timeout: 30_000 });
    } finally {
      await removeRecord(page.request, "document", documentId);
      await removeRecord(page.request, "person", heirId);
      await removeRecord(page.request, "person", deceasedId);
    }
  });
});
