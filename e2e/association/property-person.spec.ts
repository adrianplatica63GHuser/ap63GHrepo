/**
 * Case:   TC-ASSOC-04 — Persoană asociată proprietății, cu rol, văzută din ambele capete
 * Source: docs/testing/cases/TC-ASSOC-04.md, „Last green" 2026-09-25
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The case's prerequisites are TC-PROP-01's property and TC-PERS-01's
 *     person. Here they are this spec's own, created through the same POST
 *     routes those forms call and marked `TC-E2E-ASSOC-04` („TC-E2E-ASSOC-04
 *     Teren de test", „Ion TC-E2E-ASSOC-04"), so steps 4 and 10 type
 *     `TC-E2E-ASSOC-04` where the case types `TC-PERS-01` / `TC-PROP-01`.
 *   - Steps 1 and 7 open each record by its address, not from its list: the
 *     lists are TC-PROP-01's and TC-PERS-01's to drive.
 *   - Both are removed in `finally` through the DELETE routes „Șterge" calls,
 *     after the case's own cleanup (radio, „Dezasociază") has run.
 *   - Slice #37.16 checks the association tab's fixed column widths here:
 *     every column the same width at 1400 and 2400 px, the table no wider than
 *     its columns, no fixed column's cell wider than the column. Not a step of
 *     the case.
 *   - Slice #37.17: a Natural Person has no tab row; the person's „Proprietăți"
 *     is a tile, ticked with `showTile` (e2e/helpers/tiles.ts) where the hand
 *     run clicks the tile's checkbox.
 *   - Slice #37.19: nor has the property. Step 1 reads its tile row where the
 *     case reads five tabs, and its „Persoane" (steps 2 and 12) is a tile.
 *     After step 12, not a step of the case, two #37.19 checks:
 *       · the cadastral data, the owners and the map side by side, photographed
 *         at 1920 and 2560 px into `playwright-report/layout/` (synthetic
 *         records);
 *       · AN UNTICKED MAP COSTS NOTHING — the Google requests of a reload with
 *         „Hartă" ticked and of one with it unticked, counted and printed to
 *         the log (host and path only: a query string carries the API key).
 */

import { test, expect, type Request } from "@playwright/test";
import {
  E2E_MARKER,
  createNaturalPerson,
  createProperty,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";
import { expectStableColumns, photograph } from "../helpers/field-widths";
import { TILE_GROUP, hideTile, showTile, tileBox } from "../helpers/tiles";

const MARK = `${E2E_MARKER}ASSOC-04`;
const PROPERTY = `${MARK} Teren de test`;
const PERSON = `Ion ${MARK}`;
const ROLE = "Proprietar / Titular de drept real";
const ROLES = ["fără rol", "Coproprietari / Coindivizari", "Cumpărător", ROLE, "Titular de drept"];

test.describe("TC-ASSOC-04 — Persoană asociată proprietății, cu rol, văzută din ambele capete", () => {
  test("legătura persoană–proprietate făcută din fiecare capăt, citită din celălalt", async ({ page }) => {
    // Room for the `finally` (see the TC-ASSOC-01 spec).
    test.slow();
    await removeLeftovers(page.request, MARK);
    const propertyId = await createProperty(page.request, { nickname: PROPERTY });
    const personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });

    try {
      // ── From the property's end ──────────────────────────────────────────
      // Step 1 — the property's screen: its tile row (no tabs — #37.19).
      await page.goto(`/properties/${propertyId}`);
      await expect(page.getByRole("heading", { name: PROPERTY })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("group", { name: TILE_GROUP }).getByRole("checkbox")).toHaveCount(10, { timeout: 30_000 }); // #37.63: META INFO is two
      for (const tile of ["Date cadastrale", "Puncte de contur", "Adresă", "Hartă"]) await expect(tileBox(page, tile)).toBeChecked();
      for (const tile of ["Street View", "Proprietăți corelate", "Persoane", "Acte", "Clasificare subiectivă", "Conexiuni"]) await expect(tileBox(page, tile)).not.toBeChecked();
      await expect(page.getByRole("tab")).toHaveCount(0);

      // Step 2 — „Persoane": empty, „Asociază", „Dezasociază".
      await showTile(page, "Persoane");
      await expect(page.getByText("Nicio persoană asociată acestei proprietăți")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();

      // Step 3 — „Asociere persoană": „Nume", „Cod", Cod · Nume · Tip, „Rol" with the four.
      await page.getByRole("button", { name: "Asociază", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}/associate-person$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere persoană" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(PROPERTY).first()).toBeVisible();
      // `exact`: the sidebar's quick search „Nume, cod…" (the TC-ASSOC-01 spec).
      const nameFilter = page.getByPlaceholder("Nume…", { exact: true });
      await expect(page.getByPlaceholder("Cod…", { exact: true })).toBeVisible();
      for (const col of ["Nume", "Tip"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      const role = page.getByRole("combobox", { name: "Rol", exact: true });
      await expect(role.locator("option")).toHaveText(ROLES);

      // Step 4 — one row: `PPERS…`, the person, „Fizică".
      await nameFilter.fill(MARK);
      const candidates = page.getByRole("row").filter({ hasText: PERSON });
      await expect(candidates).toHaveCount(1, { timeout: 15_000 });
      await expect(candidates).not.toContainText(/PPERS\d+/); // #37.57: no system ID here
      await expect(candidates).toContainText("Fizică");

      // Step 5 — tick the row, then the role.
      await page.getByRole("checkbox", { name: PERSON }).check();
      await role.selectOption({ label: ROLE });

      // Step 6 — back on „Persoane" (`?tab=persons`): Nume · Rol, one row, no cotă-parte.
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}\\?tab=persons$`), { timeout: 30_000 });
      const onProperty = page.getByRole("row").filter({ has: page.getByRole("radio", { name: PERSON }) });
      await expect(onProperty).toHaveCount(1, { timeout: 15_000 });
      await expect(onProperty).toContainText(ROLE);
      await expect(onProperty.getByRole("link", { name: "Vizualizare" })).toBeVisible();
      const personsTable = page.getByRole("table").filter({ has: onProperty });
      for (const col of ["Nume", "Rol"]) {
        await expect(personsTable.getByText(col, { exact: true })).toBeVisible();
      }
      await expect(personsTable.getByText("Cotă-parte", { exact: true })).toHaveCount(0);
      await expectStableColumns(page);

      // Step 7 — the other end: the person's „Proprietăți", Denumire · Rol.
      await page.goto(`/natural-persons/${personId}`);
      await expect(page.getByRole("heading", { name: PERSON })).toBeVisible({ timeout: 30_000 });
      await showTile(page, "Proprietăți");
      const onPerson = page.getByRole("row").filter({ has: page.getByRole("radio", { name: PROPERTY }) });
      await expect(onPerson).toHaveCount(1, { timeout: 30_000 });
      await expect(onPerson).toContainText(ROLE);
      const propsTable = page.getByRole("table").filter({ has: onPerson });
      for (const col of ["Denumire", "Rol"]) {
        await expect(propsTable.getByText(col, { exact: true })).toBeVisible();
      }

      // ── Undo, then from the person's end ─────────────────────────────────
      // Step 8 — radio, „Dezasociază": „Nicio proprietate asociată".
      await page.getByRole("radio", { name: PROPERTY }).check();
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Nicio proprietate asociată")).toBeVisible({ timeout: 15_000 });

      // Step 9 — „Asociere proprietate": „Căutare", Cod · Denumire, the same four roles.
      await page.getByRole("button", { name: "Asociază", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${personId}/associate-property$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere proprietate" })).toBeVisible({ timeout: 30_000 });
      const search = page.getByPlaceholder("Cod sau denumire…", { exact: true });
      await expect(search).toBeVisible();
      for (const col of ["Denumire"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      await expect(role.locator("option")).toHaveText(ROLES);

      // Step 10 — the one row, ticked, the role.
      await search.fill(MARK);
      await expect(page.getByRole("row").filter({ hasText: PROPERTY })).toHaveCount(1, { timeout: 15_000 });
      await page.getByRole("checkbox", { name: PROPERTY }).check();
      await role.selectOption({ label: ROLE });

      // Step 11 — back on the person's „Proprietăți" (`?tab=properties`).
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${personId}\\?tab=properties$`), { timeout: 30_000 });
      const again = page.getByRole("row").filter({ has: page.getByRole("radio", { name: PROPERTY }) });
      await expect(again).toHaveCount(1, { timeout: 15_000 });
      await expect(again).toContainText(ROLE);

      // Step 12 — „Vizualizare": the property READ-ONLY, its „Persoane" reads the person.
      await again.getByRole("link", { name: "Vizualizare" }).click();
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}\\?readonly=true$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: PROPERTY })).toBeVisible({ timeout: 30_000 });
      await showTile(page, "Persoane");
      const readBack = page.getByRole("row").filter({ has: page.getByRole("radio", { name: PERSON }) });
      await expect(readBack).toHaveCount(1, { timeout: 30_000 });
      await expect(readBack).toContainText(ROLE);

      // Slice #37.19 — the cadastral data, the owners and the map side by side.
      await hideTile(page, "Puncte de contur");
      await hideTile(page, "Adresă");
      await expect(page.getByRole("region", { name: "Hartă", exact: true })).toBeVisible();
      await photograph(page, "property-cadastral-owners-map", [1920, 2560]);

      // Slice #37.19 — AN UNTICKED MAP COSTS NOTHING. A reload with „Hartă" ticked
      // (the control: the counter sees a map), then one with it unticked.
      const MAP_LOAD = /\/maps\/vt|\/maps\/api\/js\/(AuthenticationService|QuotaService|ViewportInfoService)|\/cbk|photometa|streetviewpixels/;
      const seen = async (): Promise<string[]> => {
        const urls: string[] = [];
        const onRequest = (r: Request): void => {
          const u = new URL(r.url());
          if (/(^|\.)(googleapis|gstatic|google)\.com$/.test(u.hostname)) urls.push(`${u.hostname}${u.pathname}`);
        };
        page.on("request", onRequest);
        try {
          await page.reload();
          await expect(page.getByRole("heading", { name: PROPERTY })).toBeVisible({ timeout: 30_000 });
          await expect(tileBox(page, "Date cadastrale")).toBeChecked({ timeout: 30_000 });
          await page.waitForTimeout(8_000);
        } finally {
          page.off("request", onRequest);
        }
        return urls;
      };
      // #37.56: at 1920 px, where the map's column stands beside the cadastral data and the
      // owners. At Playwright's 1280 the column goes under them, below the fold, and Google
      // Maps does not start a map nobody can see — so the control would count nothing.
      const before = page.viewportSize();
      await page.setViewportSize({ width: 1920, height: 1080 });
      const withMap = await seen();
      await hideTile(page, "Hartă");
      const withoutMap = await seen();
      if (before) await page.setViewportSize(before);
      await expect(page.getByRole("region", { name: "Hartă", exact: true })).toHaveCount(0);
      const tally = (urls: string[]) => ({ all: urls.length, mapLoads: urls.filter((u) => MAP_LOAD.test(u)).length });
      // Printed for the handover: host and path only, never a query string (the API key).
      console.log(`[TC-ASSOC-04 #37.19] Google requests, Hartă ticked: ${JSON.stringify(tally(withMap))}; unticked: ${JSON.stringify(tally(withoutMap))}`);
      console.log(`[TC-ASSOC-04 #37.19] unticked, every Google request: ${JSON.stringify([...new Set(withoutMap)])}`);
      expect(tally(withMap).mapLoads, "the control: a ticked map makes map requests").toBeGreaterThan(0);
      expect(withoutMap.filter((u) => MAP_LOAD.test(u)), "an unticked map makes no map request").toEqual([]);
      await showTile(page, "Persoane");

      // ── At the end — on the property's „Persoane": radio, „Dezasociază" ──
      await page.getByRole("radio", { name: PERSON }).check();
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Nicio persoană asociată acestei proprietăți")).toBeVisible({ timeout: 15_000 });
      await page.getByRole("group", { name: TILE_GROUP }).getByRole("button", { name: "Implicit", exact: true }).click();
      await expect(tileBox(page, "Hartă")).toBeChecked();
    } finally {
      await removeRecord(page.request, "person", personId);
      await removeRecord(page.request, "property", propertyId);
    }
  });
});
