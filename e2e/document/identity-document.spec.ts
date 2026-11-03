/**
 * Case:   TC-DOC-28 — Actul de identitate pe ecranul lui: un tile pe tip, VALABIL / EXPIRAT, CNP-ul verificat, tipul schimbat
 * Source: docs/testing/cases/TC-DOC-28.md
 *
 * Slice 40.83. The four identity kinds on the document's own screen, each made through POST /api/documents with
 * invented values (no real card, the capture rule) and the TC-E2E- marker, and removed in `finally`:
 *   - tip nou: its fields in the card's order, the common ones once (not in „Identificarea actului"), EXPIRAT on a
 *     validity end in the past, the warning when the CNP's sex disagrees with Sex, a CNP refused, an edit kept;
 *   - tip vechi: the booklet's own fields, no CNP, no validity, so no status;
 *   - Pașaport: VALABIL, its domicile county; Pașaport CRDS: its domicile country;
 *   - a change of type: to Pașaport names the values removed and removes them; to an ordinary type is refused while
 *     a value is held;
 *   - Documente → Adaugă act with an identity type: the tile, empty, and the value saved.
 * 41.29 (a test of its own, step 9): „Identificarea actului" at 2 units — on an invented Pașaport and an invented
 *   Contract de vânzare — keeps „Schimbă tipul…" inside the tile's inner edge; the width is put back after.
 * No map, no Street View, no address look-up.
 */
import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createDocumentOfType, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";
import { editTile, saveTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}DOC-28`;
const tile = (page: Page) => page.locator('[data-panel="identity"]');
const box = (page: Page, field: string) => tile(page).locator(`[data-width-field="${field}"]`);
const general = (page: Page) => page.locator('[data-panel="general"]');
/** 40.92: „Schimbă tipul…"'s confirmation. */
const typeChangeDialog = (page: Page) => page.locator("[data-type-change-dialog]");

/** 40.94: the tile's fields row by row, by their `data-width-field`, left to right (a TILE alone on its row). */
async function tileRows(page: Page): Promise<string[][]> {
  return tile(page).locator("[data-width-field]").evaluateAll((els) => {
    const rows = new Map<number, { left: number; key: string }[]>();
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      const top = Math.round(r.top);
      const row = [...rows.keys()].find((t) => Math.abs(t - top) <= 2) ?? top;
      rows.set(row, [...(rows.get(row) ?? []), { left: r.left, key: (el.getAttribute("data-width-field") ?? "").replace(/^identity\./, "") }]);
    }
    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.sort((x, y) => x.left - y.left).map((i) => i.key));
  });
}

/**
 * 41.29: the general panel drawn at 2 units — 254 px, 228 inside (`--tile-inner`) — as the packing draws a tile whose
 * edge was dragged there; then the button's and the value box's right edges against the panel's inner edge.
 */
async function typeRowAtTwoUnits(page: Page): Promise<{ inner: number; button: number | null; box: number }> {
  return general(page).evaluate((el: HTMLElement) => {
    el.style.setProperty("width", "254px");
    el.style.setProperty("--tile-inner", "228px");
    const s = getComputedStyle(el);
    const inner = el.getBoundingClientRect().right - parseFloat(s.paddingRight) - parseFloat(s.borderRightWidth);
    const button = el.querySelector<HTMLElement>("[data-type-change-open]")?.getBoundingClientRect().right ?? null;
    const box = el.querySelector<HTMLElement>('[data-width-field="documentTypeId"]')?.getBoundingClientRect().right ?? -1;
    return { inner, button, box };
  });
}

/**
 * 41.29: at 2 units, in edit and at rest. The width is set on the panel itself rather than dragged: under the runner
 * the document screen's tile edges answered neither the keyboard nor a drag (20261101T233722Z-7001 — no bubble, no
 * aria-valuemin), which is the edge's own matter, not this row's.
 */
async function expectTypeButtonInside(page: Page): Promise<void> {
  await editTile(page, "general");
  const inEdit = await typeRowAtTwoUnits(page);
  expect(inEdit.button, "„Schimbă tipul…\" is drawn in edit").not.toBeNull();
  expect(Math.abs(inEdit.button! - inEdit.inner), `the button ends at the tile's inner edge — ${JSON.stringify(inEdit)}`).toBeLessThanOrEqual(1);
  expect(inEdit.box, "the value box ends before the button").toBeLessThan(inEdit.button! - 7);
  await page.locator('[data-tile-cancel="general"]').click();
  const atRest = await typeRowAtTwoUnits(page);
  expect(atRest.box, `at rest the value box stays inside the tile — ${JSON.stringify(atRest)}`).toBeLessThanOrEqual(atRest.inner + 1);
  await page.reload();
}

// An invented CNP: a man born 1985-04-21, control digit valid.
const CNP = "1850421400123";

test.describe("TC-DOC-28 — actul de identitate pe ecranul lui", () => {
  test("cele patru tipuri, starea, CNP-ul, schimbarea tipului, un act nou", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const made: string[] = [];
    try {
      const nou = await createDocumentOfType(page.request, "CARTE_IDENTITATE", `${MARK} CI nou`, {
        nrDocument: "IF 123456",
        dateDocument: "2012-04-21",
        dateValidUntil: "2022-04-21",
        identity: {
          lastName: "Testescu", firstName: "Ion", cnp: CNP, sex: "FEMALE", nationality: "Română / ROU",
          placeOfBirth: "Mun. București", domicileAddress: "Str. Probei nr. 1, Bragadiru", cardNumber: "000111",
        },
      });
      made.push(nou);
      const vechi = await createDocumentOfType(page.request, "CARTE_IDENTITATE_VECHE", `${MARK} CI vechi`, {
        nrDocument: "BX 100200",
        dateDocument: "1995-06-02",
        identity: { lastName: "Testescu", firstName: "Ion", fatherFirstName: "Ilie", motherFirstName: "Ana", civilStatus: "necăsătorit" },
      });
      made.push(vechi);
      const pas = await createDocumentOfType(page.request, "PASAPORT", `${MARK} Pașaport`, {
        nrDocument: "051234876",
        dateDocument: "2022-09-01",
        dateValidUntil: "2099-09-01",
        identity: { passportType: "P", countryCode: "ROU", lastName: "Testescu", firstName: "Ion", domicileCounty: "Ilfov" },
      });
      made.push(pas);
      const crds = await createDocumentOfType(page.request, "PASAPORT_CRDS", `${MARK} Pașaport CRDS`, {
        identity: { lastName: "Testescu", firstName: "Ion", domicileCountry: "Spania" },
      });
      made.push(crds);

      // Step 1 — tip nou: read as text — its values, EXPIRAT, the CNP warning; then open, every field drawn once
      // (a read view hides an empty field behind „Arată N câmpuri goale", 40.71).
      await page.goto(`/documents/${nou}`);
      await expect(tile(page)).toBeVisible({ timeout: 30_000 });
      // 41.49: the tile is „Actul oficial" (it was „Act de identitate").
      await expect(tile(page).getByRole("heading", { level: 2 }).first()).toHaveText("Actul oficial");
      await expect(box(page, "nrDocument")).toHaveText("IF 123456");
      await expect(box(page, "identity.lastName")).toHaveText("Testescu");
      await expect(tile(page).locator('[data-identity-validity="expired"]')).toHaveText("EXPIRAT");
      await expect(tile(page).locator('[data-identity-warning="cnp_sex_mismatch"]')).toBeVisible();
      await expect(general(page).locator('[data-width-field="nrDocument"]')).toHaveCount(0);
      await editTile(page, "identity");
      for (const label of ["Seria și numărul", "CNP", "Sex", "Nume", "Prenume", "Cetățenia", "Domiciliu", "Emisă de", "Data eliberării", "Valabil până la", "MRZ", "Nr. card"]) {
        await expect(tile(page).getByText(label, { exact: true }).first()).toBeVisible();
      }
      await expect(tile(page).getByText("Data nașterii", { exact: true })).toHaveCount(0);

      // Step 2 — a CNP without its control digit is refused; Sex corrected, the warning goes; kept after a reload.
      await box(page, "identity.cnp").fill("1850421400124");
      await expect(tile(page).getByText("CNP-ul trebuie să aibă 13 cifre și o cifră de control corectă.").first()).toBeVisible();
      await box(page, "identity.cnp").fill(CNP);
      await tile(page).getByRole("combobox", { name: "Sex", exact: true }).selectOption("MALE");
      await expect(tile(page).locator('[data-identity-warning="cnp_sex_mismatch"]')).toHaveCount(0);
      await box(page, "identity.firstName").fill("Ionel");
      await saveTile(page, "identity");
      await page.reload();
      await expect(box(page, "identity.firstName")).toHaveText("Ionel", { timeout: 30_000 });
      await expect(box(page, "identity.sex")).toHaveText("M");

      // Step 3 — tip vechi: the booklet's fields; no CNP, no validity end, so no status.
      await page.goto(`/documents/${vechi}`);
      await expect(tile(page)).toBeVisible({ timeout: 30_000 });
      await expect(tile(page).locator("[data-identity-validity]")).toHaveCount(0);
      await editTile(page, "identity");
      for (const label of ["Prenumele tatălui", "Prenumele mamei", "Starea civilă", "Lucrătorul care a eliberat-o"]) {
        await expect(tile(page).getByText(label, { exact: true }).first()).toBeVisible();
      }
      await expect(tile(page).getByText("CNP", { exact: true })).toHaveCount(0);
      await expect(tile(page).getByText("Valabil până la", { exact: true })).toHaveCount(0);
      await page.locator('[data-tile-cancel="identity"]').click();

      // Step 4 — the passports: VALABIL and the county; CRDS the country.
      await page.goto(`/documents/${pas}`);
      await expect(tile(page).locator('[data-identity-validity="valid"]')).toHaveText("VALABIL", { timeout: 30_000 });
      await expect(box(page, "identity.domicileCounty")).toHaveText("Ilfov");
      await page.goto(`/documents/${crds}`);
      await expect(box(page, "identity.domicileCountry")).toHaveText("Spania", { timeout: 30_000 });

      // Step 4b — 40.94, Adrian's rows, opened so every field is drawn: the Pașaport, then the tip vechi. „Titular" is
      // the holder line above the rows, and the status sits beside Data expirării — neither is a field.
      await page.goto(`/documents/${pas}`);
      await expect(tile(page)).toBeVisible({ timeout: 30_000 });
      await editTile(page, "identity");
      expect(await tileRows(page)).toEqual([
        ["passportType", "countryCode", "nrDocument"], ["lastName", "firstName"], ["nationality", "sex"],
        ["dateOfBirth", "placeOfBirth"], ["dateDocument", "dateValidUntil"], ["issuerPersonId"], ["cnp", "domicileCounty"], ["mrz"],
      ]);
      // 41.32: Locul nașterii at M; the status right under Data expirării, its left edge the date box's.
      expect(Math.abs((await box(page, "identity.placeOfBirth").boundingBox())!.width - 136), "Locul nașterii is M").toBeLessThanOrEqual(1);
      const statusBox = (await tile(page).locator("[data-identity-validity]").boundingBox())!;
      const untilBox = (await box(page, "dateValidUntil").boundingBox())!;
      expect(Math.abs(statusBox.x - untilBox.x), "the status starts at the date box's left edge").toBeLessThanOrEqual(1);
      expect(statusBox.y, "the status under the date box").toBeGreaterThanOrEqual(untilBox.y + untilBox.height - 1);
      await page.locator('[data-tile-cancel="identity"]').click();
      await page.goto(`/documents/${vechi}`);
      await expect(tile(page)).toBeVisible({ timeout: 30_000 });
      await editTile(page, "identity");
      expect(await tileRows(page)).toEqual([
        ["lastName", "firstName"], ["fatherFirstName", "motherFirstName"], ["civilStatus", "dateOfBirth"], ["placeOfBirth"],
        // 41.32: „Seria și numărul" beside the issue date, the officer across the tile (was ["dateDocument", "issuerOfficer"], ["nrDocument"]).
        ["domicileAddress"], ["issuerPersonId"], ["dateDocument", "nrDocument"], ["issuerOfficer"],
      ]);
      // Locul nașterii, Domiciliu and Emisă de across the tile, as wide as each other.
      const across = await Promise.all(["identity.placeOfBirth", "identity.domicileAddress", "issuerPersonId", "identity.issuerOfficer"].map(async (f) => (await box(page, f).boundingBox())!.width));
      expect(Math.max(...across) - Math.min(...across), `TILE widths ${across.join(", ")}`).toBeLessThanOrEqual(1);
      await page.locator('[data-tile-cancel="identity"]').click();

      // Step 5 — tip nou to Pașaport: the values it has no field for are named, and removed on save.
      // 40.92: through „Schimbă tipul…" — its confirmation names them first; „Confirmă" changes the type in the form.
      await page.goto(`/documents/${nou}`);
      await editTile(page, "general");
      await general(page).getByRole("button", { name: "Schimbă tipul…", exact: true }).click();
      await typeChangeDialog(page).getByLabel("Tipul nou").selectOption({ label: "Pașaport" });
      const named = typeChangeDialog(page).locator('[data-type-change-list="identity"]');
      await expect(named).toContainText("Domiciliu");
      await expect(named).toContainText("Nr. card");
      await typeChangeDialog(page).getByRole("button", { name: "Confirmă", exact: true }).click();
      await expect(typeChangeDialog(page)).toHaveCount(0);
      const notice = general(page).locator('[data-identity-change="removes"]');
      await expect(notice).toContainText("Domiciliu");
      await expect(notice).toContainText("Nr. card");
      await saveTile(page, "general");
      await page.reload();
      await expect(tile(page).getByText("Nr. pașaportului", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
      await expect(box(page, "identity.lastName")).toHaveText("Testescu");
      await expect(box(page, "identity.domicileAddress")).toHaveCount(0);

      // Step 6 — to an ordinary type while a value is held: said, and refused — 40.92: the confirmation says why and
      // offers no „Confirmă"; „Anulează" leaves the type as it was.
      await editTile(page, "general");
      await general(page).getByRole("button", { name: "Schimbă tipul…", exact: true }).click();
      await typeChangeDialog(page).getByLabel("Tipul nou").selectOption({ label: "Adeverință" });
      await expect(typeChangeDialog(page).locator("[data-type-change-held]")).toContainText("goliți-le întâi");
      await expect(typeChangeDialog(page).getByRole("button", { name: "Confirmă", exact: true })).toHaveCount(0);
      await typeChangeDialog(page).getByRole("button", { name: "Anulează", exact: true }).click();
      await expect(general(page).locator('[data-read-value="documentTypeId"]')).toHaveText("Pașaport");
      await page.locator('[data-tile-cancel="general"]').click();
      await expect(page.locator('[data-tile-edit-bar="general"]')).toHaveCount(0);

      // Step 7 — Documente → Adaugă act with an identity type: the tile, empty; saved.
      await page.goto("/documents/new");
      // Slice 41.03 (FU-378): one name — „Carte de Identitate (tip vechi)", Adrian's, now in sync-reference-data.sql
      // too. Was „(model vechi)" or „(tip vechi)", either accepted. Found by its option first: a label the list lacks
      // made selectOption wait out the whole test.
      const typeSelect = page.getByLabel(/^Tip document/);
      // Slice 41.50: an identity type is marked „(F)" in the list, as a type with a form is (it read
      // `/^Carte de Identitate \(tip vechi\)$/`).
      const booklet = typeSelect.locator("option", { hasText: /^Carte de Identitate \(tip vechi\) \(F\)$/ });
      await expect(booklet).toHaveCount(1, { timeout: 30_000 });
      await expect(typeSelect.locator("option", { hasText: /^Pașaport \(F\)$/ })).toHaveCount(1);
      await typeSelect.selectOption((await booklet.getAttribute("value"))!);
      await expect(tile(page)).toBeVisible({ timeout: 30_000 });
      await expect(box(page, "identity.lastName")).toHaveValue("");
      await page.getByLabel(/^Etichetă scurtă/).fill(`${MARK} nou din Acte`);
      await box(page, "identity.lastName").fill("Testescu");
      await page.locator("#document-form").evaluate((f: HTMLFormElement) => f.requestSubmit());
      await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/, { timeout: 60_000 });
      made.push(page.url().split("/").pop()!);
      await expect(box(page, "identity.lastName")).toHaveText("Testescu", { timeout: 30_000 });
    } finally {
      for (const id of made) await removeRecord(page.request, "document", id);
    }
  });

  // Step 9 (41.29) — „Identificarea actului" at 2 units: „Schimbă tipul…" ends at the tile's inner edge (its gap to the
  // border is the tile's padding plus border), in edit; at rest the value box stays inside. On a Pașaport and on a
  // Contract de vânzare; a reload puts the tile's own width back.
  test("41.29: „Schimbă tipul…” stays inside the tile at 2 units", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, `${MARK} 41.29`);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const made: string[] = [];
    try {
      made.push(await createDocumentOfType(page.request, "PASAPORT", `${MARK} 41.29 Pașaport`, {
        identity: { lastName: "Testescu", firstName: "Ion", passportType: "P", countryCode: "ROU" },
      }));
      made.push(await createSaleContract(page.request, `${MARK} 41.29 Contract`));
      for (const id of made) {
        await page.goto(`/documents/${id}`);
        await expect(general(page)).toBeVisible({ timeout: 30_000 });
        await expectTypeButtonInside(page);
      }
    } finally {
      for (const id of made) await removeRecord(page.request, "document", id);
    }
  });
});
