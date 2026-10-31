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
 * 41.20 (step 9): on an invented natural person, the Identity tile — the refusal names what is on the screen, never
 * the screen reader's „ID sistem". 41.21: a refusal lists every line that would not fit at the asked width, each with
 * its px and the px the tile has (`readList`); step 9 drags Identitate from 3 units to 2.
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
const live = (page: Page) => page.locator('[data-tile-width-note="live"]');

/** 41.21: „N unități" as the messages write it (2 to 19 here; a tile is at most 8 on 1920 px). */
const unitsRo = (n: number) => (n === 1 ? "1 unitate" : n < 20 ? `${n} unități` : `${n} de unități`);

/**
 * 41.21: the refusal's list, read and checked — its first line, then a line per row that would not fit, each needing
 * more px than the tile has: „«Prenume | Nume» — 306 px (încap 254)", or the heading's, „titlul «…» — N px (încap 254):
 * «…» a px, spațiu g, «…» b, margini f" (its parts adding up to N). The live region: the first line and how many.
 */
async function readList(page: Page, units: number, have: number): Promise<{ name: string; px: number }[]> {
  const first = `Panoul nu poate fi mai îngust de ${unitsRo(units)}:`;
  await expect.poll(async () => (await bubble(page).textContent()) ?? "").toMatch(new RegExp(`^${first}\n`));
  const [top, ...rest] = ((await bubble(page).textContent()) ?? "").split("\n");
  expect(top).toBe(first);
  const more = rest.length > 0 && /^… și încă (un rând|\d+ (de )?rânduri)$/.test(rest[rest.length - 1]) ? rest.pop() : undefined;
  expect(rest.length).toBeGreaterThan(0);
  expect(rest.length).toBeLessThanOrEqual(6);
  const listed = rest.map((line) => {
    const r = /^«([^»]+)» — (\d+) px \(încap (\d+)\)$/.exec(line);
    const h = /^titlul «([^»]+)» — (\d+) px \(încap (\d+)\): «[^»]+» (\d+) px((?:, spațiu \d+, «[^»]+» \d+)*), margini (\d+)$/.exec(line);
    expect([line, Boolean(r || h)]).toEqual([line, true]);
    const [, name, px, room] = (r ?? h)!;
    expect([line, Number(room)]).toEqual([line, have]);
    expect([line, Number(px) > have]).toEqual([line, true]);
    if (h) {
      const sum = Number(h[4]) + [...h[5].matchAll(/spațiu (\d+), «[^»]+» (\d+)/g)].reduce((a, m) => a + Number(m[1]) + Number(m[2]), 0) + Number(h[6]);
      expect([line, sum]).toEqual([line, Number(px)]);
    }
    return { name, px: Number(px) };
  });
  const count = listed.length + (more ? Number(/\d+/.exec(more)?.[0] ?? 1) : 0);
  await expect(live(page)).toHaveText(`${first} ${count === 1 ? "Un rând nu încape" : `${count} rânduri nu încap`}.`);
  return listed;
}

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
      // 41.21: a line per row that would not fit at that width — the heading's too — each with its px (`readList`).
      await holdEdge(page, tile, (min - 1 - n) * (UNIT + GAP));
      await expect(bubble(page)).toHaveAttribute("data-verdict", "refused");
      if (min >= 2) {
        console.log(`TC-TILES-26 step 7 — ${tile} at ${min - 1}: ${JSON.stringify(await readList(page, min, unitsPx(min - 1)))}`);
      } else {
        await expect(bubble(page)).toHaveText(/^Un panou are cel puțin o unitate\.$/);
        await expect(live(page)).toHaveText(/^Un panou are cel puțin o unitate\.$/);
      }
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
      expect(now).toBe(3);
      expect(min).toBe(3);

      // 41.21 — from 3 units to 2: every line of Identitate that needs more than 254 px, each with its px; the heading
      // only if it measures so. The live region says how many.
      await holdEdge(page, "identity", (2 - now) * (UNIT + GAP));
      await expect(bubble(page)).toHaveAttribute("data-verdict", "refused");
      const listed = await readList(page, 3, unitsPx(2));
      const said = (await bubble(page).textContent()) ?? "";
      console.log(`TC-TILES-26 step 9 — the bubble:\n${said}`);
      expect(listed.some((l) => /Prenume|Nume/.test(l.name)), said).toBe(true);
      expect(listed.some((l) => l.name.startsWith("Identitate · ")), said).toBe(heading.parts.reduce((a, p) => a + Math.round(p.px), 0) + heading.gap + Math.round(heading.frame) > unitsPx(2));
      expect(said).not.toContain("ID sistem");
      await expect(live(page)).not.toContainText("ID sistem");
      await page.mouse.up();
      await expect(bubble(page)).toHaveCount(0);
      await expect.poll(async () => (await measure(page, "identity")).tile).toBe(unitsPx(min));
    } finally {
      if (id) await removeRecord(page.request, "person", id);
    }
  });

});
