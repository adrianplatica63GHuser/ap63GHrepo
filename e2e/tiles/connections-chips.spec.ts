/**
 * Case:   TC-TILES-10 — „Conexiuni": etichete mici, „×" doar la mouse sau la focalizare
 * Source: docs/testing/cases/TC-TILES-10.md, „Last green" 2026-10-03
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The person carries `TC-E2E-TILES-10` (records.ts); the tags are the
 *     case's own, prefixed `tc-e2e-tiles-10` so a hand run and the spec never
 *     share one.
 *   - „Drawn" is read as the „×" wrapper's computed opacity — Playwright counts
 *     a transparent element as visible.
 *   - Step 3 reaches the „×" with `focus()`, the same focus Tab gives, since
 *     how many Tab presses lead there depends on the rest of the page.
 */

import { test, expect, type Locator } from "../helpers/test";
import {
  E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord,
} from "../helpers/records";

const MARK = `${E2E_MARKER}TILES-10`;
const TAGS = ["tc-e2e-tiles-10 arendă", "tc-e2e-tiles-10 moștenire", "tc-e2e-tiles-10 litigiu"];

async function opacity(remove: Locator): Promise<number> {
  return Number(await remove.evaluate((b) => getComputedStyle(b.parentElement as HTMLElement).opacity));
}

async function boxes(chips: Locator): Promise<string> {
  const all = await chips.evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  }));
  return JSON.stringify(all);
}

test.describe("TC-TILES-10 — etichete mici, „×” doar la mouse sau la focalizare", () => {
  test("trei etichete: niciun „×” în repaus, „×” la mouse și la focalizare, fără mișcare, și eliminarea", async ({ page }) => {
    test.slow();
    // A run that died before its `finally` leaves its records; they would be a second match here.
    await removeLeftovers(page.request, MARK);
    const person = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    try {
      const refs = (await (await page.request.get(`/api/people/${person}/entity-references`)).json()) as { principalObjectId: string };
      for (const tag of TAGS) {
        const res = await page.request.post(`/api/metadata/${refs.principalObjectId}/tags`, { data: { tag } });
        expect(res.ok()).toBeTruthy();
      }

      // Step 1 — three chips, no „×" drawn, padding 4–8 px every side.
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto(`/natural-persons/${person}?tab=metadata`);
      const con = page.getByRole("region", { name: "Etichete și grupuri", exact: true });
      const chips = con.locator("[data-tag-chip]");
      await expect(chips).toHaveText(TAGS, { timeout: 30_000 });
      // In view first, so the hovers below never scroll and every box is read from one place.
      await chips.nth(1).scrollIntoViewIfNeeded();
      await page.mouse.move(2, 2);
      const removes = TAGS.map((t) => con.getByRole("button", { name: `Elimină eticheta ${t}`, exact: true }));
      for (const r of removes) await expect.poll(() => opacity(r)).toBe(0);
      for (const pad of await chips.evaluateAll((els) => els.map((e) => {
        const s = getComputedStyle(e);
        return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map((v) => parseFloat(v));
      }))) {
        for (const v of pad) {
          expect(v).toBeGreaterThanOrEqual(4);
          expect(v).toBeLessThanOrEqual(8);
        }
      }
      const atRest = await boxes(chips);

      // Step 2 — the mouse on „moștenire": its „×" over the top-right corner, the others not; nothing moved.
      await chips.nth(1).hover();
      await expect.poll(() => opacity(removes[1])).toBe(1);
      expect(await opacity(removes[0])).toBe(0);
      expect(await opacity(removes[2])).toBe(0);
      const x = await removes[1].boundingBox();
      const c = await chips.nth(1).boundingBox();
      expect(x!.x + x!.width).toBeGreaterThan(c!.x + c!.width - 4);
      expect(x!.y).toBeLessThan(c!.y + 4);
      expect(await boxes(chips)).toBe(atRest);

      // Step 3 — away, then focus on that „×": drawn while focused; nothing moved.
      await page.mouse.move(2, 2);
      await expect.poll(() => opacity(removes[1])).toBe(0);
      await removes[1].focus();
      await expect.poll(() => opacity(removes[1])).toBe(1);
      expect(await boxes(chips)).toBe(atRest);

      // Step 4 — the click removes „moștenire"; the other two stay.
      await chips.nth(1).hover();
      await removes[1].click();
      await expect(chips).toHaveText([TAGS[0], TAGS[2]], { timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "person", person);
    }
  });
});

// Slice 41.39 — Adrian: „once I click on the groups dropdown the tile freezes: if I click out of the drop The drop down
// doesn't come back to closed, it stays open; Also I cannot resize the tile". On an invented person and an invented group
// of persons with a 400-character description: the picker closes on a press outside and on Esc, its box never wider than
// the tile, and the tile steps from 3 units to 2 with the picker open and again once closed; Home gives the width back.
test.describe("TC-TILES-10 (41.39) — alegerea grupului se închide, dala se îngustează", () => {
  test("clic în afară, Esc, 3 → 2 unități cu alegerea deschisă și închisă", async ({ page }) => {
    test.slow();
    const MARK39 = `${MARK}-GRUP`;
    await removeLeftovers(page.request, MARK39);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const person = await createNaturalPerson(page.request, { lastName: MARK39, firstName: "Ion" });
    const g = await page.request.post("/api/groups", { data: { targetType: "PHYSICAL_PERSON", description: `${MARK39} ${"descriere lungă ".repeat(25).trim()}` } });
    expect(g.ok(), await g.text()).toBeTruthy();
    const groupId = ((await g.json()) as { group?: { id: string }; id?: string }).group?.id ?? ((await g.json()) as { id?: string }).id;
    try {
      await page.goto(`/natural-persons/${person}?tab=metadata`);
      const con = page.getByRole("region", { name: "Etichete și grupuri", exact: true });
      await expect(con).toBeVisible({ timeout: 30_000 });
      const plus = con.getByRole("button", { name: "Adaugă în grup", exact: false }).first();
      const picker = con.locator("[data-groups-picker]");
      // A press outside closes it.
      await plus.click();
      await expect(picker).toBeVisible({ timeout: 15_000 });
      const [pb, cb] = await Promise.all([picker.boundingBox(), con.boundingBox()]);
      expect(pb!.x + pb!.width, "the box inside the tile").toBeLessThanOrEqual(cb!.x + cb!.width + 0.5);
      await page.mouse.click(5, 5);
      await expect(picker).toHaveCount(0);
      // Esc closes it, the focus back on „+".
      await plus.click();
      await expect(picker).toBeVisible();
      await picker.focus();
      await page.keyboard.press("Escape");
      await expect(picker).toHaveCount(0);
      // 3 → 2 units with the picker open, then with it closed.
      const edge = page.locator('[data-tile-handle="connections"]');
      await expect(edge).toBeAttached({ timeout: 30_000 });
      const before = Number(await edge.getAttribute("aria-valuenow"));
      await plus.click();
      await expect(picker).toBeVisible();
      await edge.focus();
      await page.keyboard.press("ArrowLeft");
      await expect.poll(async () => Number(await edge.getAttribute("aria-valuenow"))).toBe(before - 1);
      await page.keyboard.press("Home");
      await expect.poll(async () => Number(await edge.getAttribute("aria-valuenow"))).toBe(before);
      await expect(picker).toHaveCount(0); // the press on the edge was outside the picker
      await edge.focus();
      await page.keyboard.press("ArrowLeft");
      await expect.poll(async () => Number(await edge.getAttribute("aria-valuenow"))).toBe(before - 1);
      await page.keyboard.press("Home");
      await expect.poll(async () => Number(await edge.getAttribute("aria-valuenow"))).toBe(before);
    } finally {
      if (groupId) await page.request.delete(`/api/groups/${encodeURIComponent(groupId)}`);
      await removeRecord(page.request, "person", person);
    }
  });
});
