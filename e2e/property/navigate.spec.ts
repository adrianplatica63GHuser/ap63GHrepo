/**
 * Case:   TC-PROP-13 — „Navighează": linkul Google Maps și codul QR, spre parcelă sau spre adresă
 * Source: docs/testing/cases/TC-PROP-13.md, „Last green" 2026-10-14
 *
 * A translation of the case file, step for step (Slice #39.35). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The properties carry `TC-E2E-PROP-13` (records.ts) and are removed in `finally`.
 *   - „Hartă" is ticked through `showTile`. The Google map stays blocked (the spec opts in for nothing): „Navighează"
 *     builds its link without Google — which is the point. Since 40.35 it stands on the map's top row, which is drawn
 *     over the map's box whether Google loads or not.
 *   - Scanning the code with a phone is Adrian's (the slice's handover); here the code's own text is read.
 */

import { test, expect, type Locator, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";
import { editTile, showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}PROP-13`;
const BASE = "https://www.google.com/maps/dir/?api=1";
const CORNERS = [
  { lat: 44.37, lon: 25.97 },
  { lat: 44.37, lon: 25.974 },
  { lat: 44.372, lon: 25.974 },
  { lat: 44.372, lon: 25.97 },
];

async function openDialog(page: Page, id: string): Promise<Locator> {
  await page.goto(`/properties/${id}`);
  const map = await showTile(page, "Hartă");
  await map.getByRole("button", { name: "Navighează", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /^Navighează la/ });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("TC-PROP-13 — „Navighează”", () => {
  test("spre parcelă: linkul, codul QR, pornirea de la o adresă; spre adresă; fără nimic, butonul spune de ce", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids: string[] = [];
    try {
      const parcel = await createProperty(page.request, { nickname: `${MARK} Livada`, corners: CORNERS });
      ids.push(parcel);
      const addressed = await page.request.post("/api/properties", {
        data: {
          nickname: `${MARK} Casa`,
          provenance: "MANUAL",
          address: { streetLine: "Strada Școlii 5", postalCode: "", locality: "Bragadiru", county: "Ilfov", country: "România", notes: "", streetViewStreetLine: "" },
        },
      });
      expect(addressed.ok(), `POST /api/properties ${addressed.status()}`).toBeTruthy();
      ids.push(((await addressed.json()) as { property: { id: string } }).property.id);
      const bare = await createProperty(page.request, { nickname: `${MARK} Nimic` });
      ids.push(bare);

      // Step 0 (Slice 40.35) — „Navighează" on the map's top row, after „Arată unghiuri" and before „HARTĂ | SATELIT";
      // no row of its own under the map, so the tile ends under the map's box; „+ Adaugă punct" in the corners
      // tile's title row, at the right.
      await page.goto(`/properties/${parcel}`);
      const mapTile = await showTile(page, "Hartă");
      const top = mapTile.locator("[data-map-top-row]");
      await expect(top.getByRole("button", { name: "Navighează", exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(mapTile.locator("[data-navigate-row]")).toHaveCount(0);
      const order = await top.evaluate((row) => {
        const els = [...row.querySelectorAll<HTMLElement>("button")];
        const at = (f: (b: HTMLElement) => boolean) => els.findIndex(f);
        return {
          angles: at((b) => /unghiuri/i.test(b.getAttribute("aria-label") ?? "")),
          navigate: at((b) => b.getAttribute("aria-label") === "Navighează"),
          switch: at((b) => /HARTĂ|STR/i.test(b.textContent ?? "")),
        };
      });
      expect(order.angles).toBeGreaterThanOrEqual(0);
      expect(order.navigate).toBe(order.angles + 1);
      expect(order.switch).toBe(order.navigate + 1);
      await expect(top.getByRole("button", { name: "Navighează", exact: true })).not.toHaveText(/Navighează/);
      const [tileBox, mapBox] = [(await mapTile.boundingBox())!, (await mapTile.locator('[data-width-field="map"]').boundingBox())!];
      expect(tileBox.y + tileBox.height - (mapBox.y + mapBox.height)).toBeLessThanOrEqual(14);
      // 40.97: Hartă has its header, the tile's name. „+ Adaugă punct" is not drawn until „Editează" (at the tile's top
      // right, as on every tile); then it stands on the „Afișare:" line, at the right (40.35–40.96: the title row).
      await expect(mapTile.locator("[data-tile-title] h2").first()).toHaveText("Hartă");
      const corners = page.locator('[data-tile="corners"]');
      const add = corners.getByRole("button", { name: "+ Adaugă punct" });
      await expect(add).toHaveCount(0);
      const edit = corners.locator("[data-tile-edit]");
      const [e, c0] = [(await edit.boundingBox())!, (await corners.boundingBox())!];
      expect(c0.x + c0.width - (e.x + e.width), "Editează at the right").toBeLessThanOrEqual(16);
      await editTile(page, "corners");
      await expect(add).toBeVisible();
      const display = corners.getByText("Afișare:", { exact: true });
      const [a, d, c] = [(await add.boundingBox())!, (await display.boundingBox())!, (await corners.boundingBox())!];
      expect(Math.abs(a.y + a.height / 2 - (d.y + d.height / 2)), "on the „Afișare:\" line").toBeLessThanOrEqual(8);
      expect(c.x + c.width - (a.x + a.width), "at its right").toBeLessThanOrEqual(16);
      await corners.locator('[data-tile-cancel="corners"]').click();

      // Step 1 — „Livada": the parcel's centre, from „Locația mea"; the link in a new tab, the phone's as a QR code.
      let dialog = await openDialog(page, parcel);
      await expect(dialog).toContainText("Spre parcelă: centrul ei pe hartă.");
      await expect(dialog.getByRole("radio", { name: "Locația mea" })).toBeChecked();
      const open = dialog.getByRole("link", { name: "Deschide în Google Maps", exact: true });
      await expect(open).toHaveAttribute("href", `${BASE}&destination=44.371000%2C25.972000&travelmode=driving`);
      await expect(open).toHaveAttribute("target", "_blank");
      const qr = dialog.getByRole("img", { name: "Cod QR cu traseul spre proprietate" });
      await expect(qr).toBeVisible();
      await expect(qr).toHaveAttribute("data-qr-text", `${BASE}&destination=44.371000%2C25.972000&travelmode=driving&dir_action=navigate`);
      expect(await qr.locator("path").getAttribute("d")).toMatch(/^M\d+ \d+h1v1h-1z/);
      await expect(dialog).toContainText("Traseul îl trasează Google Maps, cu mașina, până la cel mai apropiat drum din hartă.");

      // Step 2 — „De la o adresă": no link until it is typed; then the origin in it.
      await dialog.getByRole("radio", { name: "De la o adresă" }).check();
      await expect(dialog.getByText("Scrieți adresa de pornire, ca să apară linkul și codul QR.")).toBeVisible();
      await dialog.getByRole("textbox", { name: "Adresa de pornire" }).fill("Piața Unirii, București");
      await expect(open).toHaveAttribute("href", `${BASE}&destination=44.371000%2C25.972000&origin=Pia%C8%9Ba%20Unirii%2C%20Bucure%C8%99ti&travelmode=driving`);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);

      // Step 3 — „Casa": no shape, so its address.
      dialog = await openDialog(page, ids[1]!);
      await expect(dialog).toContainText("Spre adresa: Strada Școlii 5, Bragadiru, Ilfov, România");
      await expect(dialog.getByRole("link", { name: "Deschide în Google Maps", exact: true })).toHaveAttribute(
        "href",
        `${BASE}&destination=Strada%20%C8%98colii%205%2C%20Bragadiru%2C%20Ilfov%2C%20Rom%C3%A2nia&travelmode=driving`,
      );
      await page.keyboard.press("Escape");

      // Step 4 — „Nimic": the button disabled, saying why.
      await page.goto(`/properties/${bare}`);
      const map = await showTile(page, "Hartă");
      const button = map.getByRole("button", { name: "Navighează", exact: true });
      await expect(button).toBeDisabled();
      await expect(button).toHaveAccessibleDescription("Proprietatea nu are nici formă pe hartă, nici adresă: nu are unde duce un traseu.");
    } finally {
      for (const id of ids) await removeRecord(page.request, "property", id);
    }
  });
});
