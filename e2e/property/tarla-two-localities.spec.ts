/**
 * Case:   TC-PROP-16 — Aceeași tarla în două localități: două tarlale, două parcele 1, iar a treia parcelă 1 este refuzată
 * Source: docs/testing/cases/TC-PROP-16.md, „Last green" 2026-10-17
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The properties carry `TC-E2E-PROP-16` (records.ts); the two tarlale keep the case's code `TC16`, and any left
 *     by an interrupted run are deleted first.
 *   - Steps 3–5 open „Proprietate nouă" at `/properties/new`, the page „Introducere manuală" opens, rather than
 *     through the list's dialog (TC-PROP-01 and TC-PROP-15 walk that).
 *   - Step 11's third tarla, TC16 in Domnești, and its three corners are made through the API (POST, then PUT
 *     /api/tarlale/<id>), as the case's „Before you start" makes the first two.
 */

import { test, expect, type APIRequestContext, type Page } from "../helpers/test";
import { E2E_MARKER, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}PROP-16`;
const CODE = "TC16";
const TARLA = "/api/admin/value-lists/tarla";

type TarlaRow = { id: string; indicativ: string; locality: string | null };

async function tarlale(request: APIRequestContext): Promise<TarlaRow[]> {
  const res = await request.get(TARLA);
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { items: TarlaRow[] }).items.filter((t) => t.indicativ.toLowerCase() === CODE.toLowerCase());
}

async function removeTarlale(request: APIRequestContext): Promise<void> {
  for (const t of await tarlale(request)) await request.delete(`${TARLA}/${t.id}`);
}

async function addTarla(request: APIRequestContext, locality: string): Promise<string> {
  const res = await request.post(TARLA, { data: { indicativ: CODE, locality, county: "Ilfov" } });
  expect(res.ok(), `POST ${TARLA} ${locality}: ${res.status()}`).toBeTruthy();
  return ((await res.json()) as { id: string }).id;
}

/** „Proprietate nouă": nickname, tarla, parcel, „Salvează". */
async function newProperty(page: Page, nickname: string, tarlaLabel: string, parcela: string): Promise<void> {
  await page.goto("/properties/new");
  const tarla = page.locator('select[name="tarlaId"]');
  await expect(tarla.locator("option", { hasText: tarlaLabel })).toHaveCount(1, { timeout: 30_000 });
  await page.locator('[name="nickname"]').fill(nickname);
  await tarla.selectOption({ label: tarlaLabel });
  await page.locator('input[name="parcela"]').fill(parcela);
  await page.getByRole("button", { name: "Salvează", exact: true }).click();
}

async function propertyIdsOn(request: APIRequestContext, tarlaId: string): Promise<string[]> {
  const res = await request.get(`/api/tarlale/${tarlaId}/properties`);
  if (!res.ok()) return [];
  return ((await res.json()) as { items: { id: string }[] }).items.map((p) => p.id);
}

test.describe("TC-PROP-16 — aceeași tarla în două localități", () => {
  test("două tarlale TC16, două parcele 1, a treia refuzată", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await removeTarlale(page.request);
    await page.setViewportSize({ width: 1366, height: 900 });
    const bragadiru = await addTarla(page.request, "Bragadiru");
    const cornetu = await addTarla(page.request, "Cornetu");
    try {
      // Step 1 — two rows TC16, „Bragadiru, Ilfov" and „Cornetu, Ilfov", each with „Deschide pagina tarlalei".
      await page.goto("/admin/value-lists?list=tarla");
      const list = page.getByRole("region", { name: "Indicative Tarla", exact: true });
      const rows = list.locator("tbody tr").filter({ hasText: CODE });
      await expect(rows).toHaveCount(2, { timeout: 30_000 });
      await expect(rows.filter({ hasText: "Bragadiru, Ilfov" })).toHaveCount(1);
      await expect(rows.filter({ hasText: "Cornetu, Ilfov" })).toHaveCount(1);
      for (const r of await rows.all()) await expect(r.getByRole("link", { name: "Deschide pagina tarlalei" })).toBeVisible();

      // Step 2 — „Adaugă", tc16 in Cornetu: refused, the form still open, still two rows.
      await list.getByRole("button", { name: /Adaugă/ }).click();
      const box = (label: RegExp) => list.locator("div.flex.flex-col.gap-1", { has: page.locator("label", { hasText: label }) }).locator("input");
      await box(/^Indicativ/).fill("tc16");
      await box(/^Localitate/).fill("Cornetu");
      await list.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(
        page.getByRole("alert").filter({ hasText: "Există deja, în aceeași localitate, un indicativ de tarla care se citește la fel ca acesta: „TC16”." }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(box(/^Indicativ/)).toBeVisible();
      await expect(rows).toHaveCount(2);

      // Step 3 — TC16 (Bragadiru), parcel 1: saved, back in the list at the top with „Nou!".
      await newProperty(page, `${MARK} Bragadiru`, `${CODE} (Bragadiru)`, "1");
      await expect(page).toHaveURL(/\/properties$/, { timeout: 30_000 });
      await expect(page.locator("tbody tr").first()).toContainText(`${MARK} Bragadiru`, { timeout: 30_000 });
      await expect(page.locator("tbody tr").first()).toContainText("Nou!");

      // Step 4 — TC16 (Cornetu), parcel 1: saved as well, not refused.
      await newProperty(page, `${MARK} Cornetu`, `${CODE} (Cornetu)`, "1");
      await expect(page).toHaveURL(/\/properties$/, { timeout: 30_000 });
      await expect(page.locator("tbody tr").first()).toContainText(`${MARK} Cornetu`, { timeout: 30_000 });

      // Step 5 — TC16 (Bragadiru), parcel 1 again: refused, naming the first.
      await newProperty(page, `${MARK} Al doilea`, `${CODE} (Bragadiru)`, "1");
      const refused = page.getByRole("alert").filter({ hasText: "Această parcelă are deja o proprietate" });
      await expect(refused).toBeVisible({ timeout: 30_000 });
      await expect(refused).toContainText("Tarla TC16, parcela 1 aparține deja proprietății de mai jos. Nu s-a creat o proprietate nouă.");
      await expect(refused).toContainText(`Deschide ${MARK} Bragadiru`);
      await expect(page).toHaveURL(/\/properties\/new$/);

      // Step 6 — /tarlale: the box with six facts; two rows TC16, one property each.
      await page.goto("/tarlale");
      const info = page.locator("[data-tarla-boundaries-info]");
      await expect(info.getByRole("heading", { name: "Despre limitele tarlalelor" })).toBeVisible({ timeout: 30_000 });
      await expect(info.locator("li")).toHaveCount(6);
      const tarlaRows = page.locator(`[data-tarla-row="${CODE}"]`);
      await expect(tarlaRows).toHaveCount(2, { timeout: 30_000 });
      for (const locality of ["Bragadiru", "Cornetu"]) {
        const r = tarlaRows.filter({ hasText: locality });
        await expect(r).toHaveCount(1);
        await expect(r.locator("td").nth(4)).toHaveText("1");
      }

      // Step 7 — Cornetu's TC16: its heading, the box, its locality, only its own property.
      await tarlaRows.filter({ hasText: "Cornetu" }).getByRole("link", { name: CODE }).click();
      await expect(page).toHaveURL(new RegExp(`/tarlale/${cornetu}$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Tarla ${CODE} — Cornetu`, { timeout: 30_000 });
      await expect(page.locator("[data-tarla-boundaries-info] li")).toHaveCount(6);
      await expect(page.locator("[data-tarla-identity] input").nth(1)).toHaveValue("Cornetu");
      await expect(page.locator("[data-tarla-properties] h2")).toHaveText("O proprietate", { timeout: 30_000 });
      await expect(page.locator("[data-tarla-property]")).toHaveCount(1);
      await expect(page.locator("[data-tarla-property]")).toContainText(`${MARK} Cornetu`);

      // Step 8 — #39.77: at 1920 × 1080 the panels are tiles — thirds (476 px) and, for the two big lists, halves
      // (804 px); „Implicit" at the top right; each big list at most two thirds of the window, its header on top.
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect(page.locator('[data-tile-positions-reset="tarla"]')).toBeVisible();
      // #39.87: „Despre limitele tarlalelor" is a tile too, the first, a third.
      for (const [tile, px] of [["facts", 476], ["identity", 476], ["outline", 476], ["plans", 476], ["parcels", 476], ["properties", 804], ["documents", 804]] as const)
        await expect(page.locator(`[data-tile-screen="tarla"] > [data-tile="${tile}"]`)).toHaveCSS("width", `${px}px`);
      const big = page.locator("[data-tarla-big-list]");
      await expect(big).toHaveCount(1); // Cornetu's TC16 has a property and no document, so only its properties' list
      expect(Math.abs(parseFloat(await big.evaluate((el) => getComputedStyle(el).maxHeight)) - 0.66 * 1080)).toBeLessThan(2);
      await expect(big.locator("thead")).toHaveCSS("position", "sticky");
      await expect(page.locator('[data-tile-screen="tarla"] > [data-tile="facts"] li')).toHaveCount(6);
      // #39.87: the page's buttons under the last tile, a divider above them.
      const buttons = page.locator("[data-tarla-save]");
      const tilesBottom = await page.locator('[data-tile-screen="tarla"]').evaluate((el) => el.getBoundingClientRect().bottom);
      expect((await buttons.boundingBox())!.y).toBeGreaterThanOrEqual(tilesBottom);
      await expect(buttons).toHaveCSS("border-top-style", "solid");
      for (const name of ["Salvează", "Șterge", "Anulează"]) await expect(buttons.getByRole("button", { name, exact: true })).toBeVisible();

      // Step 9 — #39.87: „Descriere" typed, then „Anulează": what was saved comes back, on the same page.
      const save = buttons.getByRole("button", { name: "Salvează", exact: true });
      const cancel = buttons.getByRole("button", { name: "Anulează", exact: true });
      await expect(save).toBeDisabled();
      await expect(cancel).toBeDisabled();
      const descriere = page.locator("[data-tarla-identity] input").nth(3);
      await descriere.fill(MARK);
      await expect(save).toBeEnabled();
      await expect(cancel).toBeEnabled();
      await cancel.click();
      await expect(descriere).toHaveValue("");
      await expect(save).toBeDisabled();
      await expect(cancel).toBeDisabled();
      await expect(page).toHaveURL(new RegExp(`/tarlale/${cornetu}$`));

      // Step 10 — „Șterge" on a tarla a property stands on: Reference Data's own refusal, nothing deleted.
      await buttons.getByRole("button", { name: "Șterge", exact: true }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog.getByRole("heading", { name: "Ștergeți „TC16”?" })).toBeVisible();
      await expect(dialog).toContainText("1 obiect depinde de această valoare, așa că ștergerea nu este posibilă acum:", { timeout: 15_000 });
      await expect(dialog.locator("li")).toHaveText(["1 proprietate"]);
      await expect(dialog.getByRole("button", { name: "Șterge", exact: true })).toHaveCount(0);
      await dialog.getByRole("button", { name: "Anulează", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      expect((await tarlale(page.request)).map((t) => t.id)).toContain(cornetu);

      // Step 11 — a third TC16, in Domnești, with three corners: one line per corner at 1366 and at 1920, nothing
      // scrolling sideways; then „Șterge" deletes it and the page goes back to the tarla list.
      const domnesti = await addTarla(page.request, "Domnești");
      const put = await page.request.put(`/api/tarlale/${domnesti}`, {
        data: {
          indicativ: CODE, locality: "Domnești", county: "Ilfov", descriere: "", notes: "",
          corners: [
            { lat: 44.3912345, lon: 25.9112345, originalIndex: 1 },
            { lat: 44.3922345, lon: 25.9132345, originalIndex: 2 },
            { lat: 44.3902345, lon: 25.9142345, originalIndex: 3 },
          ],
        },
      });
      expect(put.ok(), `PUT /api/tarlale/${domnesti}: ${put.status()}`).toBeTruthy();
      await page.goto(`/tarlale/${domnesti}`);
      const corners = page.locator("[data-tarla-outline] [data-corner-buttons]");
      for (const width of [1366, 1920]) {
        await page.setViewportSize({ width, height: 1080 });
        await expect(corners).toHaveCount(3, { timeout: 30_000 });
        for (const row of await corners.all()) {
          const tops = await row.locator("button").evaluateAll((bs) => bs.map((b) => Math.round(b.getBoundingClientRect().top)));
          expect(tops, `${width} px: the four buttons on one line`).toHaveLength(4);
          expect(new Set(tops).size, `${width} px: the four buttons on one line`).toBe(1);
        }
        const sideways = await page.locator("[data-tarla-outline] table").evaluate((el) => {
          const frame = el.parentElement!;
          return frame.scrollWidth - frame.clientWidth;
        });
        expect(sideways, `${width} px: the corners' table does not scroll sideways`).toBeLessThanOrEqual(0);
        await expect(page.locator('[data-tile-screen="tarla"] > [data-tile="outline"]')).toHaveCSS("width", "476px");
      }
      await page.locator("[data-tarla-save]").getByRole("button", { name: "Șterge", exact: true }).click();
      await expect(dialog).toContainText("Nimic nu depinde de această valoare.", { timeout: 15_000 });
      await dialog.getByRole("button", { name: "Șterge", exact: true }).click();
      await expect(page).toHaveURL(/\/tarlale$/, { timeout: 30_000 });
      await expect(page.locator(`[data-tarla-row="${CODE}"]`)).toHaveCount(2, { timeout: 30_000 });
      expect((await tarlale(page.request)).map((t) => t.id)).not.toContain(domnesti);
    } finally {
      // At the end — the two properties, then the two tarlale.
      await page.waitForLoadState("networkidle").catch(() => {});
      for (const t of [bragadiru, cornetu]) for (const p of await propertyIdsOn(page.request, t)) await removeRecord(page.request, "property", p);
      await removeLeftovers(page.request, MARK);
      await removeTarlale(page.request);
    }
  });
});
