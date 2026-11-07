/**
 * Case:   TC-STAMP-02 — Aplicarea unei ștampile: descrierea compactă și elementele în două liste (41.43; patru fișe până atunci)
 * Source: docs/testing/cases/TC-STAMP-02.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The stamp and the persons carry `TC-E2E-STAMP-02` (records.ts); the
 *     `finally` removes the stamp through DELETE /api/stamps/[id] even when an
 *     assertion failed first (`removeStampLeftovers`) — a stamp is shared state.
 *   - Playwright's mouse drags; the hand run dispatched pointer events from a
 *     script (FU-290). Each reading is polled until it holds.
 *   - The places are read relative to the row, in px; the expected ones are
 *     computed from the tiles' own sizes, not written down.
 */

import { test, expect, type Page } from "../helpers/test";
import { closeTiles, expectPanouriRoundTrip, openTiles, tilesMenuButton } from "../helpers/tiles";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord, removeStampLeftovers } from "../helpers/records";

const MARK = `${E2E_MARKER}STAMP-02`;
const KEY = "ga40-tile-positions-admin-stamp-v1";
const GAP = 16;

type Box = { x: number; y: number; w: number; h: number };

/** Every tile of the row, relative to the row. */
async function boxes(page: Page): Promise<Record<string, Box>> {
  return page.evaluate(() => {
    const row = document.querySelector<HTMLElement>("[data-tile-row]")!.getBoundingClientRect();
    const out: Record<string, Box> = {};
    for (const e of document.querySelectorAll<HTMLElement>("[data-tile-row] [data-tile]")) {
      const r = e.getBoundingClientRect();
      out[e.dataset.tile!] = { x: Math.round(r.left - row.left), y: Math.round(r.top - row.top), w: Math.round(r.width), h: Math.round(r.height) };
    }
    return out;
  });
}

test.describe("TC-STAMP-02 — aplicarea unei ștampile: descrierea și elementele, două liste într-o fișă (41.43)", () => {
  test("1366 și 1920: descrierea compactă, elementele sub ea sau alături; ștampilate cu bifă și buton, cu dublu clic, una scoasă; salvat", async ({ page }) => {
    test.slow();
    await removeStampLeftovers(page.request, MARK);
    await removeLeftovers(page.request, MARK);
    const ids: string[] = [];
    let stampId = "";
    try {
      const s = await page.request.post("/api/stamps", { data: { shortDescription: `${MARK} Ștampilă de test`, notes: "" } });
      expect(s.status()).toBe(201);
      stampId = ((await s.json()) as { id: string }).id;
      for (const n of ["Ion", "Ana", "Dan"]) ids.push(await createNaturalPerson(page.request, { lastName: MARK, firstName: n }));
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto(`/admin/stamps/${stampId}`);
      await page.evaluate((k) => localStorage.removeItem(k), KEY);
      await page.reload();
      const region = (name: string) => page.getByRole("region", { name, exact: true });
      const description = region("Descrierea ștampilei");
      const records = region("Elementele ștampilei");
      const stamped = records.getByRole("region", { name: "Elemente deja ștampilate", exact: true });
      const available = records.getByRole("region", { name: "Elemente disponibile pentru ștampilare", exact: true });
      const row = (list: typeof stamped, n: string) => list.getByRole("listitem").filter({ hasText: `${n} ${MARK}` });

      // Step 1 — 1366: the description 2 units, the code and the short description on one line; the records 7 units,
      // under it, „Tip element" over both lists on „Persoană fizică"; „Panouri".
      await expect(description).toBeVisible({ timeout: 30_000 });
      await expect(description.locator("[data-stamp-identity-line]")).toHaveText(new RegExp(`^STMP-[A-Z]{3} · ${MARK} Ștampilă de test$`));
      await expect(description.getByRole("button", { name: "Salvează ștampilele" })).toBeDisabled();
      const select = records.getByRole("combobox", { name: "Tip element", exact: true });
      await expect(select.locator("option:checked")).toHaveText("Persoană fizică");
      await expect(records.getByText("Sunt afișate doar elementele de tipul selectat", { exact: false })).toBeVisible();
      await expect(stamped.getByText("Niciun element ștampilat încă")).toBeVisible({ timeout: 30_000 });
      await expect(tilesMenuButton(page)).toBeVisible({ timeout: 30_000 });
      await expect.poll(async () => { const b = await boxes(page); return [b.description?.w, b.records?.w]; }, { timeout: 20_000 }).toEqual([254, 929]);
      await expect.poll(async () => { const b = await boxes(page); return { x: b.records.x, y: b.records.y - b.description.h }; }, { timeout: 20_000 })
        .toEqual({ x: 0, y: GAP });
      const [l, r] = await Promise.all([stamped.boundingBox(), available.boundingBox()]);
      if (!l || !r) throw new Error("a list is not on the page");
      expect(l.x).toBeLessThan(r.x);
      expect(Math.min(l.width, r.width)).toBeGreaterThanOrEqual(363);

      // Step 2 — 1920: the records at the description's right, tops level.
      await page.setViewportSize({ width: 1920, height: 1000 });
      await expect.poll(async () => { const b = await boxes(page); return { x: b.records.x, y: b.records.y }; }, { timeout: 20_000 }).toEqual({ x: 254 + GAP, y: 0 });

      // Step 3 — the search, Ion and Ana ticked, „‹ Aplică ștampila (2)": both on the left, „în așteptare".
      await available.getByRole("searchbox", { name: "Caută în elementele disponibile" }).fill(MARK);
      await expect(row(available, "Dan")).toBeVisible({ timeout: 15_000 });
      const apply = records.getByRole("button", { name: /^‹ Aplică ștampila \(\d+\)$/ });
      await expect(apply).toHaveText("‹ Aplică ștampila (0)");
      await expect(apply).toBeDisabled();
      for (const n of ["Ion", "Ana"]) await row(available, n).getByRole("checkbox").check();
      await apply.click();
      for (const n of ["Ion", "Ana"]) await expect(row(stamped, n)).toContainText("în așteptare");
      await expect(records.getByText("Modificări în așteptare")).toBeVisible();

      // Step 4 — a double-click on Dan moves him left.
      await row(available, "Dan").dblclick();
      await expect(row(stamped, "Dan")).toContainText("în așteptare");
      await expect(stamped.locator("[data-two-list-count]")).toHaveText("3");

      // Step 5 — Ion ticked on the left, „Elimină ștampila › (1)": back on the right.
      await row(stamped, "Ion").getByRole("checkbox").check();
      await records.getByRole("button", { name: "Elimină ștampila › (1)", exact: true }).click();
      await expect(row(available, "Ion")).toBeVisible();
      await expect(row(stamped, "Ion")).toHaveCount(0);

      // Step 6 — „Salvează ștampilele": Ana and Dan stamped, nothing pending; after a reload the same.
      await description.getByRole("button", { name: "Salvează ștampilele" }).click();
      await expect(description.getByText("Modificări nesalvate")).toHaveCount(0, { timeout: 15_000 });
      await expect(stamped.getByText("în așteptare")).toHaveCount(0);
      await page.reload();
      await expect(stamped.locator("[data-two-list-count]")).toHaveText("2", { timeout: 30_000 });
      for (const n of ["Ana", "Dan"]) await expect(row(stamped, n)).toBeVisible();
      await expect(row(stamped, "Ion")).toHaveCount(0);
    } finally {
      await page.evaluate((k) => localStorage.removeItem(k), KEY).catch(() => undefined);
      if (stampId) await page.request.delete(`/api/stamps/${stampId}`);
      await removeStampLeftovers(page.request, MARK);
      for (const id of ids) await removeRecord(page.request, "person", id);
    }
  });
});

// Slice 41.41: on Ștampile and on one stamp's screen, „Panouri" hides a tile, a reload keeps it hidden, „Implicit" brings it back.
test.describe("TC-STAMP-02 (41.41) — „Panouri” pe Ștampile și pe ecranul unei ștampile", () => {
  test("ascunsă, păstrată la reîncărcare, adusă înapoi de „Implicit”", async ({ page }) => {
    test.slow();
    const MARK41 = `${MARK}-PANOURI`;
    await removeStampLeftovers(page.request, MARK41);
    await page.setViewportSize({ width: 1920, height: 1080 });
    try {
      await page.goto("/admin/stamps");
      await expectPanouriRoundTrip(page, "Ce este o Ștampilă?", "about");
      // 41.44: „Cum lucrezi cu ștampilele", beside it; „Panouri" hides it too. 41.99 rewrote this in place — it read
      // `toContainText("„‹ Aplică ștampila”")` and five [data-workflow-step]: the tile now asks first, and shows no step yet.
      const workflows = page.getByRole("region", { name: "Cum lucrezi cu ștampilele", exact: true });
      await expect(workflows).toContainText("Ce vrei să faci?");
      await expect(workflows.locator("[data-workflow-step]")).toHaveCount(0);
      await expectPanouriRoundTrip(page, "Cum lucrezi cu ștampilele", "workflows");
      const s = await page.request.post("/api/stamps", { data: { shortDescription: `${MARK41} Ștampilă`, notes: "" } });
      expect(s.ok(), await s.text()).toBeTruthy();
      const body = (await s.json()) as { id?: string; stamp?: { id: string } };
      const stampId = body.stamp?.id ?? body.id;
      await page.goto(`/admin/stamps/${stampId}`);
      await expectPanouriRoundTrip(page, "Elementele ștampilei", "records");
      await expect(page.getByRole("region", { name: "Cum lucrezi cu ștampilele", exact: true })).toBeVisible();
      await expectPanouriRoundTrip(page, "Cum lucrezi cu ștampilele", "workflows");
    } finally {
      await removeStampLeftovers(page.request, MARK41);
    }
  });
});

// Slice 41.99 — Adrian: „Everything that I have requested for the group's functionality should be applied very similarly to
// the stems functionality including the colour of the fonts the behavior of the What is a stamp tile Adding uh all left and
// all up to the panels function Turning the tile how you work with stamps into a radio button type of wizard … making the
// buttons calm and managing the width of the tiles". 41.98's group case, on Ștampile.
test.describe("TC-STAMP-02 (41.99) — Ștampile ca Grupuri", () => {
  test("„Ce este o Ștampilă?” roșie, pe toată lățimea, o dată pe autentificare; asistentul de 3 unități; rânduri calme; alegerea pe bej", async ({ page }) => {
    test.slow();
    const M = `${MARK}-4199`;
    await removeStampLeftovers(page.request, M);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const s = await page.request.post("/api/stamps", { data: { shortDescription: `${M} Ștampilă`, notes: "" } });
    expect(s.ok(), await s.text()).toBeTruthy();
    const RED = "rgb(192, 0, 0)";
    try {
      await page.goto("/admin/stamps");
      const about = page.getByRole("region", { name: "Ce este o Ștampilă?", exact: true });
      const wizard = page.getByRole("region", { name: "Cum lucrezi cu ștampilele", exact: true });
      const list = page.locator('[data-tile="list"]');
      const row = page.locator("[data-tile-row]");
      await expect(about).toBeVisible({ timeout: 30_000 });
      // All its text red; across the whole row.
      const colours = await about.locator("h2, p").evaluateAll((els) => [...new Set(els.filter((e) => !e.closest("[data-tile-close-anchor]") && (e.textContent ?? "").trim()).map((e) => getComputedStyle(e).color))]);
      expect(colours).toEqual([RED]);
      await expect.poll(async () => {
        const [a, r] = await Promise.all([about.boundingBox(), row.boundingBox()]);
        return Math.abs(a!.width - r!.width) <= 1;
      }, { timeout: 15_000 }).toBe(true);
      await expect.poll(async () => Math.round((await wizard.boundingBox())!.width), { timeout: 15_000 }).toBe(389);
      await expect.poll(async () => Math.round((await list.boundingBox())!.width)).toBe(524);
      // „Panouri": „Toate sus" and „Toate la stânga".
      await openTiles(page);
      await expect(page.getByRole("button", { name: "Toate sus", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Toate la stânga", exact: true })).toBeVisible();
      await closeTiles(page);
      // „Am înțeles" closes it; the two rise; a reload keeps it closed; a new sign-in opens it.
      const top = (await row.boundingBox())!.y;
      await about.getByRole("button", { name: "Am înțeles", exact: true }).click();
      await expect(about).toHaveCount(0);
      await expect.poll(async () => Math.abs((await wizard.boundingBox())!.y - top) <= 2, { timeout: 15_000 }).toBe(true);
      await page.reload();
      await expect(wizard).toBeVisible({ timeout: 30_000 });
      await expect(about).toHaveCount(0);
      await page.evaluate(() => localStorage.setItem("ga40-sign-in-v1", `${Date.now()}`));
      await page.reload();
      await expect(about).toBeVisible({ timeout: 30_000 });
      // The wizard: the question, red; a choice's steps only, lit on the note box.
      await page.evaluate(() => localStorage.removeItem("ga40-stamp-wizard-v1"));
      await page.reload();
      await expect(wizard.getByText("Ce vrei să faci?", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(wizard.locator("[data-workflow-step]")).toHaveCount(0);
      const apply = wizard.locator('[data-wizard-choice="apply"]');
      await apply.getByRole("radio").check();
      await expect(wizard.locator("[data-workflow-step]")).toHaveCount(2);
      await expect(wizard.locator('[data-workflow-step="members"]')).toContainText("„‹ Aplică ștampila”");
      await expect(wizard.locator("[data-workflow-note]")).toContainText("„Etichete și grupuri”");
      await expect(apply).toHaveAttribute("data-wizard-lit", "");
      await expect(apply).toHaveCSS("background-color", "rgb(255, 251, 235)");
      await expect(apply).not.toHaveAttribute("data-wizard-lit", "", { timeout: 15_000 });
      await page.evaluate(() => localStorage.removeItem("ga40-stamp-wizard-v1"));
      // The list's row buttons: 35 % at rest, full under the pointer.
      const mine = list.locator("tbody tr").filter({ hasText: `${M} Ștampilă` });
      const buttons = mine.locator('[data-row-buttons="quiet"]');
      await page.mouse.move(2, 2);
      await expect.poll(() => buttons.evaluate((b) => getComputedStyle(b).opacity), { timeout: 15_000 }).toBe("0.35");
      await mine.hover();
      await expect.poll(() => buttons.evaluate((b) => getComputedStyle(b).opacity)).toBe("1");
    } finally {
      await removeStampLeftovers(page.request, M);
    }
  });
});
