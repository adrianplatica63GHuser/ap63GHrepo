/**
 * Case:   TC-ASSOC-12 — Defunctul și doi moștenitori adăugați pe un Certificat de Moștenitor
 * Source: docs/testing/cases/TC-ASSOC-12.md, „Last green" 2026-09-26
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Slice #38.38: „Defunct" and „Moștenitor" are ROLES on the certificate. They
 * were a quality — two buttons on „Adaugă parte la certificat" and a column of
 * their own — which FU-224 (#37.07) then showed under „Rol" elsewhere. Now the
 * dialog offers the type's roles in a „Rol" list, „Părți" reads Nume · Rol, and
 * the role is what every other tile shows. The case's third party, a second
 * heir, is the slice's: one Defunct and two Moștenitori, read again after a
 * reload.
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
 *   - Slice #37.67: so are each person's „Persoane", „Proprietăți" and „Acte": the certificate on one
 *     line — „Etichetă scurtă (Tip)" — and the person's quality behind „Relația" (step 8).
 *
 * Slice #39.48: ONE RULE FOR THE THREE TYPES WITH „PĂRȚI". The certificate's „Părți" is the sale contract's
 * tile: its parties — the links whose role holds a share, the heirs — grouped by role, each with „Cotă";
 * „Legături" the rest — the deceased — and a line saying where the parties are. Its „Asociază persoană" still
 * opens „Adaugă parte la certificat". So steps 2, 5–7 and the cleanup read the tiles, not a table.
 */

import { test, expect, type Page } from "../helpers/test";
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
const SECOND_HEIR = `Ion ${MARK} Mostenitor`;
const CERTIFICATE = `${MARK} Certificat de test`;

/** The certificate's „Părți" tile (#39.48: the sale contract's), found by its tile, not its title. */
const partiesOf = (page: Page) => page.locator('[data-tile="parties"]').filter({ visible: true });

/**
 * „Asociază persoană" on „Părți" is a button that navigates once the page is interactive; a
 * press the moment the certificate renders can do nothing, and the screen it
 * opens compiles on first request under `next dev` (the first runner run,
 * 20260927T004011Z-17430, sat 30 s on the certificate). So it is pressed until
 * the screen changes, for up to 90 s.
 */
async function openAddParty(page: Page, documentId: string) {
  await expect(async () => {
    if (/associate-party$/.test(page.url())) return;
    await partiesOf(page).getByRole("button", { name: "Asociază persoană", exact: true }).click({ timeout: 5_000 });
    await expect(page).toHaveURL(new RegExp(`/documents/${documentId}/associate-party$`), { timeout: 15_000 });
  }).toPass({ timeout: 90_000 });
}

/** On „Adaugă parte la certificat": pick the person, the role, „Adaugă parte". */
async function pickParty(page: Page, documentId: string, person: string, role: "Defunct" | "Moștenitor") {
  await page.getByPlaceholder("Nume…", { exact: true }).fill(MARK);
  const row = page.getByRole("row").filter({ hasText: person });
  await expect(row).toHaveCount(1, { timeout: 15_000 });
  await row.getByRole("radio").check();
  // Slice #38.38: a role must be chosen, and the button waits for it.
  await expect(page.getByText("Alegeți rolul persoanei în certificat", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adaugă parte", exact: true })).toBeDisabled();
  await page.getByRole("combobox", { name: "Rol", exact: true }).selectOption({ label: role });
  await page.getByRole("button", { name: "Adaugă parte", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/documents/${documentId}$`), { timeout: 30_000 });
}

/** The „Părți" row of one heir: one line, „Nume (Rol)", with its „Cotă". */
async function expectParty(page: Page, person: string, role: string) {
  const row = lineRow(partiesOf(page), person);
  await expect(row).toHaveCount(1, { timeout: 15_000 });
  await expect(row.locator("[data-row-content]")).toHaveText(`${person} (${role})`);
  await expect(row.getByRole("button", { name: "Cotă", exact: true })).toHaveCount(1);
}

const PARTIES_EMPTY = "Nicio parte asociată încă. Asociați părțile cu rolul și cota lor.";

test.describe("TC-ASSOC-12 — Defunctul și doi moștenitori adăugați pe un Certificat de Moștenitor", () => {
  test("moștenitorii în „Părți” cu rolul și cota lor, defunctul pe „Legături”, și după reîncărcare; legătura văzută din ambele capete", async ({ page }) => {
    // Room for a first-request compile of the screen it opens (below) and for the `finally`.
    test.setTimeout(300_000);
    await removeLeftovers(page.request, MARK);
    const deceasedId = await createNaturalPerson(page.request, { lastName: `${MARK} Defunct`, firstName: "Vasile" });
    const heirId = await createNaturalPerson(page.request, { lastName: `${MARK} Mostenitor`, firstName: "Maria" });
    const secondHeirId = await createNaturalPerson(page.request, { lastName: `${MARK} Mostenitor`, firstName: "Ion" });
    const documentId = await createDocumentOfType(page.request, "CERTIFICAT_MOSTENITOR", CERTIFICATE);

    try {
      // Step 2 — the certificate: the tile „Părți", ticked, empty, with „Asociază persoană"; „Legături" says the
      // parties are added there.
      await page.goto(`/documents/${documentId}`);
      await expect(page.getByRole("heading", { name: CERTIFICATE })).toBeVisible({ timeout: 30_000 });
      await expect(tileBox(page, "Identificarea actului")).toBeChecked({ timeout: 30_000 });
      await expect(tileBox(page, "Părți")).toBeChecked({ timeout: 30_000 });
      // The tile draws its title before its list answers; under load (full
      // 20260928T233256Z-25761) the list took longer than the default 5 s.
      await expect(partiesOf(page).getByText(PARTIES_EMPTY)).toBeVisible({ timeout: 30_000 });
      await expect(partiesOf(page).getByRole("button", { name: "Asociază persoană", exact: true })).toBeVisible();
      const links = await showTile(page, "Legături");
      await expect(links.locator("[data-parties-elsewhere]")).toHaveText("Actul nu are încă părți; ele se adaugă în fișa „Părți”.", { timeout: 30_000 });

      // Step 3 — „+ Adaugă parte": the screen, the title, „Nume" / „Cod", Nume · Tip with a radio
      // per row, a pager, „Rol" with the certificate's roles, „Selectați o persoană".
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
      const roleSelect = page.getByRole("combobox", { name: "Rol", exact: true });
      await expect(roleSelect).toBeVisible({ timeout: 30_000 });
      for (const offered of ["Defunct", "Moștenitor"]) {
        // Exact: `hasText` is a case-insensitive substring, and „Coproprietar / Co-moștenitor"
        // is on the certificate too (full-db 20261008T121259Z-10666).
        await expect(roleSelect.locator("option", { hasText: new RegExp(`^${offered}$`) })).toHaveCount(1);
      }
      // The two quality buttons are gone.
      await expect(page.getByRole("button", { name: "Defunct", exact: true })).toHaveCount(0);
      await expect(page.getByText("Calitate", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Selectați o persoană", { exact: true })).toBeVisible();

      // Steps 4–5 — the deceased, „Defunct", „Adaugă parte": he holds no share, so he is not a party — „Părți"
      // stays empty and „Legături" has him, „Nume (Rol)", without „Cotă".
      await pickParty(page, documentId, DECEASED, "Defunct");
      const parties = partiesOf(page);
      await expect(parties.getByText(PARTIES_EMPTY)).toBeVisible({ timeout: 30_000 });
      const deceasedRow = lineRow(links, DECEASED);
      await expect(deceasedRow.locator("[data-row-content]")).toHaveText(`${DECEASED} (Defunct)`, { timeout: 15_000 });
      await expect(deceasedRow.getByRole("button", { name: "Cotă", exact: true })).toHaveCount(0);

      // Step 6 — the two heirs, „Moștenitor": „Părți" holds them under „Moștenitor", each with „Cotă".
      for (const heir of [HEIR, SECOND_HEIR]) {
        await openAddParty(page, documentId);
        await pickParty(page, documentId, heir, "Moștenitor");
      }
      await expect(parties.locator("[data-party-group-heading]")).toHaveText(["Moștenitor"], { timeout: 15_000 });
      await expect(parties.locator("[data-row-content]")).toHaveCount(2);

      // …and the same after a reload: the role is stored, not held on the screen.
      await page.reload();
      await expect(parties.locator("[data-row-content]")).toHaveCount(2, { timeout: 30_000 });
      await expectParty(page, HEIR, "Moștenitor");
      await expectParty(page, SECOND_HEIR, "Moștenitor");

      // Step 7 — „Legături": the deceased only, and the line — two parties, in „Părți"; its „Părți" brings the
      // tile into view. One home for each link (#38.33's rule, the certificate's since #39.48).
      await expect(links.locator("[data-row-content]")).toHaveText([`${DECEASED} (Defunct)`], { timeout: 15_000 });
      const line = links.locator("[data-parties-elsewhere]");
      await expect(line).toHaveText("Părțile actului (2) sunt în fișa „Părți”.");
      await line.getByRole("button", { name: "„Părți”", exact: true }).click();
      await expect(parties).toBeInViewport({ timeout: 15_000 });

      // Step 8 — each person's „Legături": the title, „Certificat de Moștenitor", the role behind „Relația".
      for (const [id, person, role] of [[heirId, HEIR, "Moștenitor"], [deceasedId, DECEASED, "Defunct"]] as const) {
        await page.goto(`/natural-persons/${id}`);
        await expect(page.getByRole("heading", { name: person })).toBeVisible({ timeout: 30_000 });
        const r = lineRow(await showTile(page, "Legături"), CERTIFICATE);
        await expect(r).toHaveCount(1, { timeout: 15_000 });
        await expect(r.locator("[data-row-content]")).toHaveText(`${CERTIFICATE} (Certificat de Moștenitor)`);
        await r.getByRole("button", { name: "Relația", exact: true }).click();
        await expect(page.getByRole("status").filter({ hasText: "Rol: „" })).toHaveText(`Rol: „${role}”`);
        await page.keyboard.press("Escape");
      }

      // ── At the end — „Dezasociază" on each heir in „Părți"; empty again, and after a reload ──
      await page.goto(`/documents/${documentId}`);
      await expect(parties.locator("[data-row-content]")).toHaveCount(2, { timeout: 30_000 });
      for (const [heir, left] of [[HEIR, 1], [SECOND_HEIR, 0]] as const) {
        await parties.getByRole("radio", { name: `${heir} — Moștenitor` }).check();
        await parties.getByRole("button", { name: "Dezasociază", exact: true }).click();
        await expect(parties.locator("[data-row-content]")).toHaveCount(left, { timeout: 15_000 });
      }
      await expect(parties.getByText(PARTIES_EMPTY)).toBeVisible({ timeout: 15_000 });
      await page.reload();
      await expect(partiesOf(page).getByText(PARTIES_EMPTY)).toBeVisible({ timeout: 30_000 });
    } finally {
      await removeRecord(page.request, "document", documentId);
      await removeRecord(page.request, "person", secondHeirId);
      await removeRecord(page.request, "person", heirId);
      await removeRecord(page.request, "person", deceasedId);
    }
  });
});
