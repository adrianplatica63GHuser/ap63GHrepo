/**
 * Case:   TC-LAYOUT-07 — Barele de derulare ale listelor nu clipesc când fereastra e mărită, maximizată sau micșorată
 * Source: docs/testing/cases/TC-LAYOUT-07.md, „Last green" 2026-10-21
 *
 * Slice 40.14. Adrian, 2026-10-21: „flickering of scroll bars - these are the scroll bars of the lists … happens when I
 * maximize the browser". A frame's scroll bars may change once after a resize — appear or go as the new size requires —
 * and never blink. The case cannot be driven by hand (a blink is one or two paints, 16–33 ms): every reading is taken
 * after each paint for about a second after the resize, in the page, and counted.
 *
 * ⚠️ **SCROLL BARS ARE SHOWN.** Headless Chromium hides them (Playwright passes `--hide-scrollbars`), and a hidden bar
 * takes no room, so no loop can form and every run is green whatever the code does — measured: the first probe of this
 * slice, 9 passed on the code that flickered. Shown, they are the classic bars Adrian's Windows Chrome draws, 15 px.
 *
 * The rows are the archive's own, unsearched — a page of them — and only boxes are read, no text. Proprietăți's list
 * loads no map (none is on the list, and e2e blocks them anyway): no Street View, no address look-up.
 */

import { test, expect, type Page } from "../helpers/test";

test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

const LISTS = ["/natural-persons", "/judicial-persons", "/properties", "/documents"];

/** What is read off one frame after a paint. */
type Reading = { cw: number; ch: number; v: boolean; h: boolean };
type Sample = { vw: number; vh: number; page: boolean; frames: Reading[] };
type Size = { width: number; height: number };

/** Every scrolling frame on the page that holds a table — the four lists' `[data-list-frame]` among them, and a modal's,
 *  which is drawn outside `main`. */
async function arm(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __samples: Sample[]; __sampling: boolean };
    w.__samples = [];
    w.__sampling = true;
    const frames = () =>
      [...document.querySelectorAll<HTMLElement>("body *")].filter((el) => {
        if (!el.querySelector("table")) return false;
        const cs = getComputedStyle(el);
        return /(auto|scroll)/.test(cs.overflowX + cs.overflowY);
      });
    const read = (f: HTMLElement): Reading => {
      const cs = getComputedStyle(f);
      const bx = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
      const by = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
      return { cw: f.clientWidth, ch: f.clientHeight, v: f.offsetWidth - f.clientWidth - bx > 0.5, h: f.offsetHeight - f.clientHeight - by > 0.5 };
    };
    // After the paint: a task queued from the frame's callback runs once the frame is drawn.
    const sample = () => {
      const ps = document.querySelector<HTMLElement>("[data-page-scroll]");
      w.__samples.push({ vw: window.innerWidth, vh: window.innerHeight, page: ps ? ps.offsetWidth - ps.clientWidth > 0 : false, frames: frames().map(read) });
      if (w.__sampling) requestAnimationFrame(() => setTimeout(sample, 0));
    };
    requestAnimationFrame(() => setTimeout(sample, 0));
  });
}

/**
 * Resizes, samples for 1.1 s, and says which reading changed more than once at the new size. `keys` are the readings
 * checked: on the four lists all four; on the other tables (step 7) the two bars only, since a frame there may be as
 * tall as its content and its height then follows the page's own measuring.
 */
async function resizeTo(page: Page, size: Size, keys: readonly (keyof Reading)[] = ["cw", "ch", "v", "h"]): Promise<string[]> {
  await arm(page);
  await page.setViewportSize(size);
  await page.waitForTimeout(1_100);
  const all = await page.evaluate(() => {
    const w = window as unknown as { __samples: Sample[]; __sampling: boolean };
    w.__sampling = false;
    return w.__samples;
  });
  const at = all.filter((s) => s.vw === size.width && s.vh === size.height);
  const out: string[] = [];
  if (at.length < 20) out.push(`${size.width}×${size.height}: only ${at.length} paints sampled`);
  let page_ = 0;
  for (let i = 1; i < at.length; i++) if (at[i].page !== at[i - 1].page) page_++;
  if (page_ > 1) out.push(`${size.width}×${size.height}: the page's own bar changed ${page_}×`);
  const n = Math.max(0, ...at.map((s) => s.frames.length));
  for (let f = 0; f < n; f++) {
    for (const key of keys) {
      let changes = 0;
      let turns = 0;
      let way = 0;
      for (let i = 1; i < at.length; i++) {
        const a = at[i - 1].frames[f]?.[key];
        const b = at[i].frames[f]?.[key];
        if (b === a) continue;
        changes++;
        // Slice 40.67: a frame's height may change twice — the window, then its page refilled with the window's own
        // row count — but only ever one way. Going back (taller, shorter, taller) is the flicker this case is about.
        const now = typeof a === "number" && typeof b === "number" ? Math.sign(b - a) : 0;
        if (way !== 0 && now !== way) turns++;
        if (now !== 0) way = now;
      }
      const allowed = key === "ch" ? 2 : 1;
      if (changes > allowed || turns > 0) {
        const seq = at.slice(0, 8).map((s) => { const r = s.frames[f]; return r ? `${r.cw}×${r.ch}${r.v ? "V" : ""}${r.h ? "H" : ""}` : "-"; });
        out.push(`${size.width}×${size.height}: frame ${f} ${key} changed ${changes}× (${seq.join(" ")} …)`);
      }
    }
  }
  return out;
}

/** The list's frame, settled: how tall its rows are and how tall it may be. */
async function frameNow(page: Page) {
  return page.evaluate(() => {
    const f = document.querySelector<HTMLElement>("main [data-list-frame]")!;
    return { sw: f.scrollWidth, cw: f.clientWidth, sh: f.scrollHeight, ch: f.clientHeight, oh: f.offsetHeight, max: parseFloat(f.style.maxHeight) || 0 };
  });
}

async function openList(page: Page, path: string) {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto(path);
  await expect.poll(async () => page.locator("main [data-list-frame] tbody tr").count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(5);
  await page.waitForTimeout(800);
}

test.describe("TC-LAYOUT-07 — barele de derulare se așază o singură dată după o redimensionare", () => {
  for (const list of LISTS) {
    test(`${list}: maximizare, marginea pe înălțime, marginea pe lățime`, async ({ page }) => {
      test.slow();
      const wrong: string[] = [];
      await openList(page, list);

      // Steps 1–2 — the maximise: 1280 × 600 to 1920 × 1080, and back, twice.
      for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 600 }, { width: 1920, height: 1080 }]) wrong.push(...(await resizeTo(page, size)));

      // Step 3 — the heights either side of where a page of rows just fits at 1920 wide.
      const s = await frameNow(page);
      const edgeH = Math.round(1080 + (s.sh + (s.oh - s.ch) - s.max));
      for (const d of [-30, -1, 0, 1, 30, -1, 1]) wrong.push(...(await resizeTo(page, { width: 1920, height: edgeH + d })));

      // Step 4 — the widths either side of where the table just fits, at 1080 tall: found by halving.
      let lo = 800;
      let hi = 1920;
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        await page.setViewportSize({ width: mid, height: 1080 });
        await page.waitForTimeout(250);
        const r = await frameNow(page);
        if (r.sw > r.cw) lo = mid;
        else hi = mid;
      }
      for (const d of [-30, -1, 0, 1, 30]) wrong.push(...(await resizeTo(page, { width: hi + d, height: 1080 })));

      // Step 5 — both edges at once.
      for (const d of [-1, 1]) for (const e of [-1, 1]) wrong.push(...(await resizeTo(page, { width: hi + d, height: edgeH + e })));

      expect({ list, wrong }).toEqual({ list, wrong: [] });
    });
  }

  // Step 6 — at 125 % (Windows' display scaling), the maximise on each list.
  test.describe("la 125 %", () => {
    test.use({ deviceScaleFactor: 1.25 });
    test("cele patru liste, maximizare și înapoi", async ({ page }) => {
      test.slow();
      const wrong: string[] = [];
      for (const list of LISTS) {
        await openList(page, list);
        for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 600 }]) wrong.push(...(await resizeTo(page, size)).map((w) => `${list} ${w}`));
      }
      expect(wrong).toEqual([]);
    });
  });

  // Step 7 — the other frames that take the window's height or have the lines 40.12 drew: the same maximise, and back.
  test("celelalte tabele: maximizare și înapoi", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto("/natural-persons");
    const open = page.locator("main [data-list-frame] tbody tr").first().locator("a[data-row-name-link]");
    await expect(open).toBeVisible({ timeout: 30_000 });
    const person = new URL((await open.getAttribute("href"))!, "http://x").pathname;
    const screens = [
      "/",
      "/admin/value-lists?list=document-types",
      "/admin/value-lists?list=person-roles",
      "/admin/groups",
      "/admin/stamps",
      "/admin/calculation/history",
      `${person}/associate-document`,
    ];
    const wrong: string[] = [];
    const noTable: string[] = [];
    for (const screen of screens) {
      await page.setViewportSize({ width: 1280, height: 600 });
      await page.goto(screen);
      try {
        await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 30_000 });
      } catch {
        noTable.push(screen);
        continue;
      }
      await page.waitForTimeout(1_000);
      for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 600 }, { width: 1366, height: 768 }]) wrong.push(...(await resizeTo(page, size, ["v", "h"])).map((w) => `${screen} ${w}`));
    }
    expect({ noTable, wrong }).toEqual({ noTable: [], wrong: [] });
  });
});

/**
 * Slice 40.67 — as many rows a page as the window holds, never fewer than 10; a resize keeps the first row on screen.
 * Steps 8–9 of the case, on „Proprietăți" (617 records in the archive, so every height has pages to spare).
 */
test.describe("TC-LAYOUT-07 — câte rânduri încap în fereastră (40.67)", () => {
  test("două înălțimi, două numere de rânduri, amândouă cel puțin 10; după o redimensionare, primul rând rămâne pe ecran", async ({ page }) => {
    test.slow();
    const rows = page.locator("main [data-list-frame] tbody tr");
    const pageOf = page.locator("main").getByText(/^Pagina \d+ din \d+$/);
    const frameFits = () =>
      page.evaluate(() => {
        const f = document.querySelector<HTMLElement>("main [data-list-frame]")!;
        return f.scrollHeight <= f.clientHeight + 1;
      });

    // Step 8 — 1366 × 900, then 1366 × 640: a row count for each, both at least 10, the taller one more; each page
    // fits its frame without scrolling.
    await page.setViewportSize({ width: 1366, height: 900 });
    // Oldest change first: a record another spec adds meanwhile goes to the end, so page 3 holds the same rows.
    await page.goto("/properties?sort=changed&order=asc");
    await expect.poll(() => rows.count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(10);
    await page.waitForTimeout(600);
    const tall = await rows.count();
    expect(await frameFits()).toBe(true);

    // Step 9 — on page 3, the first row noted; the window shortened: the page shown is the one holding that row.
    const next = page.locator("main").getByRole("button", { name: "Următor", exact: true });
    await next.click();
    await expect(pageOf).toHaveText(/^Pagina 2 din/, { timeout: 30_000 });
    await next.click();
    await expect(pageOf).toHaveText(/^Pagina 3 din/, { timeout: 30_000 });
    await expect.poll(() => rows.count(), { timeout: 30_000 }).toBe(tall);
    const first = await rows.first().locator("a[data-row-name-link]").getAttribute("href");
    expect(first).toBeTruthy();

    await page.setViewportSize({ width: 1366, height: 640 });
    await expect.poll(() => rows.count(), { timeout: 30_000 }).not.toBe(tall);
    const short = await rows.count();
    expect(short).toBeGreaterThanOrEqual(10);
    expect(short).toBeLessThan(tall);
    // Row 2 × tall (0-based) is on page ⌊2 × tall ÷ short⌋ + 1.
    await expect(pageOf).toHaveText(new RegExp(`^Pagina ${Math.floor((2 * tall) / short) + 1} din`), { timeout: 30_000 });
    await expect(page.locator(`main [data-list-frame] tbody tr a[data-row-name-link][href="${first}"]`)).toHaveCount(1, { timeout: 30_000 });
    if (short > 10) expect(await frameFits()).toBe(true);
  });
});
