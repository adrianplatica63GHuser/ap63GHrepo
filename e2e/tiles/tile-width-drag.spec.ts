/**
 * Case:   TC-TILES-26 — Lățimea unei plăci, trasă de marginea dreaptă: se prinde la unități întregi, rămâne după reîncărcare, „Implicit” o uită
 * Source: docs/testing/cases/TC-TILES-26.md, „Last green" 2026-10-31
 *
 * Slice 41.17. On an invented property (created through the route, removed at the end) at 1920 × 1080: the first tile
 * whose handle allows a unit either way and that holds a field box. A third of a unit left is one unit fewer; a third
 * right, twice, one more than it had; a reload keeps it; „Implicit” forgets it; the keyboard steps a unit and Home
 * gives the tile its own width back. The field box keeps its width throughout. 41.18: past its narrowest the drag is
 * refused, and says why; two units past what it needs it is advised against, and taken. The map tile is not drawn (maps are
 * blocked by default): no map, no Street View, no address look-up.
 *
 * 41.20 (step 9): on an invented natural person, the Identity tile dragged one unit past its narrowest — the refusal
 * names what is on the screen, „titlul «Identitate · …»" with its px taken apart, or a row of fields, and never the
 * screen reader's „ID sistem". The heading's parts are measured and logged, for the handover's answer.
 */
import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, createProperty, removeLeftovers, removeRecord } from "../helpers/records";
import { pressTileButton } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-26`;
const UNIT = 119;
const GAP = 16;
const unitsPx = (n: number) => n * UNIT + (n - 1) * GAP;

/** The row box of tile `id` — the element the packing places — and its first box of a fixed width. */
const measure = (page: Page, id: string) =>
  page.evaluate((id) => {
    const tile = document.querySelector(`[data-tile="${id}"]`)?.closest<HTMLElement>("[data-packed-col]");
    const field = [...(tile?.querySelectorAll<HTMLElement>("[data-width-field]") ?? [])].find((f) => /rem$/.test(f.style.width));
    return { tile: tile?.getBoundingClientRect().width ?? -1, field: field?.getBoundingClientRect().width ?? -1 };
  }, id);

/** 41.18: press the edge and move it `dx` without letting go — the bubble is read while it is held. */
async function holdEdge(page: Page, id: string, dx: number): Promise<void> {
  const box = (await page.locator(`[data-tile-handle="${id}"]`).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(40, box.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 4 });
  await page.mouse.move(x + dx, y, { steps: 4 });
}

const bubble = (page: Page) => page.locator('[data-tile-width-note="bubble"]');

async function dragEdge(page: Page, id: string, dx: number): Promise<void> {
  const box = (await page.locator(`[data-tile-handle="${id}"]`).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(40, box.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 4 });
  await page.mouse.move(x + dx, y, { steps: 4 });
  await page.mouse.up();
}

test.describe("TC-TILES-26 — lățimea unei plăci", () => {
  test("a dragged right edge snaps to whole units, a reload keeps it, „Implicit” forgets it", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    let id: string | undefined;
    try {
      id = await createProperty(page.request, { nickname: `${MARK} Teren` });
      await page.goto(`/properties/${id}`);
      const handles = page.locator("[data-tile-handle]");
      await expect(handles.first()).toBeAttached({ timeout: 30_000 });

      // Step 1 — every tile has its handle, a separator named for it; the first that can go a unit either way.
      const seen: { tile: string; now: number; min: number; max: number; field: number }[] = [];
      for (const h of await handles.all()) {
        await expect(h).toHaveAttribute("role", "separator");
        await expect(h).toHaveAttribute("aria-label", /^Lățimea panoului \S/);
        await h.focus();
        const tile = (await h.getAttribute("data-tile-handle"))!;
        const [now, min, max] = await Promise.all(["aria-valuenow", "aria-valuemin", "aria-valuemax"].map((a) => h.getAttribute(a)));
        seen.push({ tile, now: Number(now), min: Number(min), max: Number(max), field: (await measure(page, tile)).field });
      }
      const pick = seen.find((s) => s.now >= 2 && s.min <= s.now - 1 && s.max >= s.now + 1 && s.field > 0);
      expect(pick, JSON.stringify(seen)).toBeTruthy();
      const tile = pick!.tile;
      const n = pick!.now;
      const before = await measure(page, tile);
      expect(before.tile).toBe(unitsPx(n));

      // Step 2 — a third of a unit left: one unit fewer, the field box as it was.
      await dragEdge(page, tile, -(UNIT + GAP) / 3);
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n - 1));
      expect((await measure(page, tile)).field).toBe(before.field);

      // Step 3 — a third right, twice: its own width, then one unit more.
      await dragEdge(page, tile, (UNIT + GAP) / 3);
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n));
      await dragEdge(page, tile, (UNIT + GAP) / 3);
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n + 1));
      expect((await measure(page, tile)).field).toBe(before.field);
      const kept = await page.evaluate((tile) => {
        for (const k of Object.keys(localStorage).filter((x) => x.startsWith("ga40-tile-positions-"))) {
          const v = JSON.parse(localStorage.getItem(k) ?? "{}")[tile];
          if (v) return v.units ?? null;
        }
        return null;
      }, tile);
      expect(kept).toBe(n + 1);

      // Step 4 — a reload keeps it.
      await page.reload();
      await expect(page.locator(`[data-tile-handle="${tile}"]`)).toBeAttached({ timeout: 30_000 });
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n + 1));
      expect((await measure(page, tile)).field).toBe(before.field);

      // Step 5 — „Implicit” forgets it with the places.
      await pressTileButton(page, "Implicit");
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n));

      // Step 6 — the keyboard: Right one unit more, Home its own width again.
      const handle = page.locator(`[data-tile-handle="${tile}"]`);
      await handle.focus();
      await page.keyboard.press("ArrowRight");
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n + 1));
      await expect(handle).toBeFocused();
      await page.keyboard.press("Home");
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n));
      expect((await measure(page, tile)).field).toBe(before.field);

      // Step 7 (41.18) — one unit past its narrowest (what the edge says it is): refused, and why — the row that sets it,
      // or, where its content fits one unit, that a tile is at least one. The edge stops; let go, the narrowest.
      const edge = page.locator(`[data-tile-handle="${tile}"]`);
      await edge.focus();
      const min = Number(await edge.getAttribute("aria-valuemin"));
      const max = Number(await edge.getAttribute("aria-valuemax"));
      // 41.20: or the heading, named by what is visible, its px taken apart — „titlul «…» are nevoie de N px — «…» N px, …".
      const why =
        min >= 2
          ? /^Panoul nu poate fi mai îngust de (\d+ unități|\d+ de unități): (rândul «[^»]+» are nevoie de \d+ px|titlul «[^»]+» are nevoie de \d+ px — «[^»]+» \d+ px(, spațiu \d+, «[^»]+» \d+)*, margini \d+)\.$/
          : /^Un panou are cel puțin o unitate\.$/;
      await holdEdge(page, tile, (min - 1 - n) * (UNIT + GAP));
      await expect(bubble(page)).toHaveText(why);
      await expect(bubble(page)).toHaveAttribute("data-verdict", "refused");
      await expect(page.locator('[data-tile-width-note="live"]')).toHaveText(why);
      await page.mouse.up();
      await expect(bubble(page)).toHaveCount(0);
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(min));

      // Step 8 (41.18) — two units past what it needs: advised against, and taken.
      expect(min + 2).toBeLessThanOrEqual(max);
      await holdEdge(page, tile, 2 * (UNIT + GAP));
      await expect(bubble(page)).toHaveText(/Cu 2 unități mai lat decât îi trebuie: rămâne loc gol în dreapta câmpurilor\./);
      await expect(bubble(page)).toHaveAttribute("data-verdict", "advised");
      await page.mouse.up();
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(min + 2));
      expect((await measure(page, tile)).field).toBe(before.field);
    } finally {
      if (id) await removeRecord(page.request, "property", id);
    }
  });

  test("the refusal names only what is on the screen — a natural person's Identity tile (41.20)", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    let id: string | undefined;
    try {
      // Invented: the marker as the name, a synthetic CNP as the other specs use.
      id = await createNaturalPerson(page.request, {
        lastName: `${MARK} Popescu`,
        firstName: "Ana-Maria",
        cnp: "1800101420096",
        gender: "FEMALE",
        dateOfBirth: "1980-01-01",
        placeOfBirth: "Mun. București",
      });
      await page.goto(`/natural-persons/${id}`);
      const edge = page.locator('[data-tile-handle="identity"]');
      await expect(edge).toBeAttached({ timeout: 30_000 });

      // Step 9 — the handle is named by what is on the screen too; the heading's parts, measured as the bubble takes them.
      await expect(edge).toHaveAttribute("aria-label", /^Lățimea panoului Identitate · \S/);
      await expect(edge).not.toHaveAttribute("aria-label", /ID sistem/);
      await edge.focus();
      const now = Number(await edge.getAttribute("aria-valuenow"));
      const min = Number(await edge.getAttribute("aria-valuemin"));
      const heading = await page.evaluate(() => {
        const box = document.querySelector<HTMLElement>('[data-tile="identity"]')!;
        const h = box.querySelector<HTMLElement>("h2")!;
        const cs = getComputedStyle(h);
        const parts = [...h.childNodes].map((n) => {
          if (n.nodeType === Node.TEXT_NODE) {
            const r = document.createRange();
            r.selectNodeContents(n);
            return { text: (n.textContent ?? "").trim(), px: r.getBoundingClientRect().width };
          }
          const el = n as HTMLElement;
          const shown = [...el.querySelectorAll<HTMLElement>("span")].filter((s) => !s.classList.contains("sr-only"));
          return { text: shown.map((s) => s.textContent).join("").trim(), px: el.getBoundingClientRect().width };
        });
        const b = box.getBoundingClientRect();
        const hr = h.getBoundingClientRect();
        const bs = getComputedStyle(box);
        return {
          parts,
          gap: parseFloat(cs.columnGap) || 0,
          frame: hr.left - b.left + (b.right - hr.right),
          tile: b.width,
          padding: [bs.paddingLeft, bs.borderLeftWidth],
          scrollWidth: box.scrollWidth,
          clientWidth: box.clientWidth,
        };
      });
      console.log(`TC-TILES-26 step 9 — Identity: ${now} units, narrowest ${min}; heading ${JSON.stringify(heading)}`);
      expect(min).toBeGreaterThanOrEqual(2);

      await holdEdge(page, "identity", (min - 1 - now) * (UNIT + GAP));
      await expect(bubble(page)).toHaveAttribute("data-verdict", "refused");
      const said = (await bubble(page).textContent()) ?? "";
      console.log(`TC-TILES-26 step 9 — the bubble: ${said}`);
      await expect(bubble(page)).toHaveText(
        /^Panoul nu poate fi mai îngust de (\d+ unități|\d+ de unități): (titlul «Identitate · [^»]+» are nevoie de \d+ px — «Identitate» \d+ px, spațiu \d+, «[^»]+» \d+, margini \d+|rândul «[^»]+» are nevoie de \d+ px)\.$/,
      );
      expect(said).not.toContain("ID sistem");
      await expect(page.locator('[data-tile-width-note="live"]')).not.toContainText("ID sistem");
      await page.mouse.up();
      await expect(bubble(page)).toHaveCount(0);
      await expect.poll(async () => (await measure(page, "identity")).tile).toBe(unitsPx(min));
    } finally {
      if (id) await removeRecord(page.request, "person", id);
    }
  });

});
