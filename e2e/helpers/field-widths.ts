/**
 * Fixed widths, checked in the browser.                    (Slice #37.12)
 *
 * `src/lib/ui/field-widths.ts` gives every field on a fixed-width screen its
 * width, and its components mark each box with `data-width-field` (the field's
 * name) and `data-width-kind`, and each panel with `data-panel`. This helper
 * reads those marks, so a spec asserts the rule itself — THE WINDOW DECIDES HOW
 * MANY PANELS FIT, NEVER HOW WIDE ANYTHING IS — rather than a list of pixel
 * numbers that would need editing every time a width changes.
 *
 * #37.12 uses it on the Natural Person (TC-PERS-01's spec); #37.13–#37.15 call
 * the same three functions on their screens.
 *
 * Slice #37.15: a box that is not drawn — on a notebook page that is not open —
 * is skipped by the "holds its value" check (it is 0 px wide, and says nothing),
 * and so is a dropdown marked `data-width-capped`: the rule stopped it at XXL on
 * purpose, and its chosen option shows in full on hover.
 */

import { expect, type Locator, type Page } from "@playwright/test";

/**
 * THREE WINDOW WIDTHS, ONE ANSWER (Slice #37.23): a 1366-pixel laptop, a
 * 1920-pixel monitor and a 2560-pixel one. Every check in this file compares
 * them by default; #37.12–#37.22 compared 1400 and 2400.
 */
export const THREE_WIDTHS = [1366, 1920, 2560] as const;

/**
 * Wait until the screen stops adding marked boxes, panels and columns: a tile
 * whose data arrives late (META INFO's tag box) must be on the screen at the
 * FIRST width too, or the widths compare two different screens. (Slice #37.23)
 */
export async function settled(page: Page): Promise<void> {
  const marks = () => page.locator("[data-width-field], [data-panel], th[data-width-column]").count();
  // Unchanged over two readings 1.5 s apart, up to half a minute.
  let last = -1;
  let same = 0;
  for (let i = 0; i < 20 && same < 2; i++) {
    const now = await marks();
    same = now === last ? same + 1 : 0;
    last = now;
    if (same < 2) await page.waitForTimeout(1500);
  }
}

/** How many small tiles fit on one row at each width — #37.17's target. */
export const SMALL_TILES_PER_ROW: Readonly<Record<number, number>> = { 1366: 2, 1920: 3, 2560: 4 };

export interface WidthSnapshot {
  /** Box width in px, by `data-width-field`. */
  fields: Record<string, number>;
  /** Panel width in px, by `data-panel`. */
  panels: Record<string, number>;
}

/** Every marked box's and panel's width, in CSS pixels. */
export async function readWidths(page: Page): Promise<WidthSnapshot> {
  return page.evaluate(() => {
    const fields: Record<string, number> = {};
    const panels: Record<string, number> = {};
    document.querySelectorAll<HTMLElement>("[data-width-field]").forEach((el) => {
      fields[el.dataset.widthField ?? "?"] = Math.round(el.getBoundingClientRect().width * 10) / 10;
    });
    document.querySelectorAll<HTMLElement>("[data-panel]").forEach((el) => {
      panels[el.dataset.panel ?? "?"] = Math.round(el.getBoundingClientRect().width * 10) / 10;
    });
    return { fields, panels };
  });
}

/**
 * Resize the window to each width in turn and assert that every marked box and
 * every panel is exactly as wide at all of them. Puts the window back as it was.
 */
export async function expectStableWidths(page: Page, widths: readonly number[] = THREE_WIDTHS, height = 900): Promise<WidthSnapshot> {
  await settled(page);
  const before = page.viewportSize();
  const snaps: WidthSnapshot[] = [];
  try {
    for (const width of widths) {
      await page.setViewportSize({ width, height });
      // Two frames: the resize, then the layout it causes.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
      snaps.push(await readWidths(page));
    }
  } finally {
    if (before) await page.setViewportSize(before);
  }
  const [first, ...rest] = snaps;
  expect(Object.keys(first.fields).length, "no box carries data-width-field").toBeGreaterThan(0);
  for (const [i, s] of rest.entries()) {
    expect(s.fields, `box widths at ${widths[i + 1]} px differ from ${widths[0]} px`).toEqual(first.fields);
    expect(s.panels, `panel widths at ${widths[i + 1]} px differ from ${widths[0]} px`).toEqual(first.panels);
  }
  return first;
}

/**
 * Every FIXED box holds its widest legitimate value without scrolling, drawn in
 * the font the page actually renders: `samples` maps a field's name to that
 * value (the `sample` in `field-widths.ts`), and a select is checked against
 * its own longest option, less the arrow. No panel's content is wider than the
 * panel. Returns what did not fit, so the failure names it.
 */
export async function expectFixedFieldsHold(page: Page, samples: Readonly<Record<string, string>>): Promise<void> {
  const misfits = await page.evaluate((s) => {
    const out: string[] = [];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return ["no 2d canvas"];
    const inner = (el: HTMLElement): number => {
      const cs = getComputedStyle(el);
      return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    };
    const drawn = (el: HTMLElement): boolean => el.getClientRects().length > 0;
    const textWidth = (el: HTMLElement, text: string): number => {
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      return ctx.measureText(text).width;
    };
    document.querySelectorAll<HTMLElement>('[data-width-kind="fixed"]').forEach((el) => {
      const name = el.dataset.widthField ?? "?";
      const sample = s[name];
      if (!sample || !(el instanceof HTMLInputElement) || el.type === "date" || !drawn(el)) return;
      const need = textWidth(el, sample);
      if (need > inner(el)) out.push(`${name}: „${sample}" needs ${need.toFixed(1)} px, the box has ${inner(el).toFixed(1)}`);
    });
    document.querySelectorAll<HTMLSelectElement>('select[data-width-kind="select"]').forEach((el) => {
      if (!drawn(el) || el.dataset.widthCapped === "true") return;
      const name = el.dataset.widthField ?? "?";
      const longest = [...el.options].map((o) => o.text).sort((a, b) => b.length - a.length)[0] ?? "";
      const need = textWidth(el, longest) + 24; // the arrow
      if (need > inner(el)) out.push(`${name}: its longest option „${longest}" needs ${need.toFixed(1)} px, the box has ${inner(el).toFixed(1)}`);
    });
    document.querySelectorAll<HTMLElement>("[data-panel]").forEach((el) => {
      if (!drawn(el)) return;
      if (el.scrollWidth > el.clientWidth + 1) out.push(`panel ${el.dataset.panel}: content ${el.scrollWidth} px in ${el.clientWidth} px`);
    });
    return out;
  }, samples);
  expect(misfits, "fixed boxes that do not hold their value").toEqual([]);
}

/**
 * Tables at fixed column widths (Slice #37.16).
 *
 * Every header cell of a converted table carries `data-width-column` (the
 * column's name in `COLUMN`) and `data-width-kind`. This resizes the window to
 * each width and asserts every such column is exactly as wide at all of them,
 * and that a table is no wider than its columns. Then, at the first width, no
 * FIXED column's cell is wider inside than out (a code, a date, a button that
 * does not fit), while a WRAPS column's cell may grow downward. Returns the
 * widths by column name, for the caller to compare with `columnRem`.
 */
export async function expectStableColumns(page: Page, widths: readonly number[] = THREE_WIDTHS, height = 900): Promise<Record<string, number>> {
  await settled(page);
  const read = () =>
    page.evaluate(() => {
      const cols: Record<string, number> = {};
      const tables: string[] = [];
      document.querySelectorAll<HTMLTableElement>("table[data-width-table]").forEach((table, t) => {
        let sum = 0;
        table.querySelectorAll<HTMLElement>("thead th[data-width-column]").forEach((th) => {
          const w = th.getBoundingClientRect().width;
          sum += w;
          cols[`${t}:${th.dataset.widthColumn}`] = Math.round(w * 10) / 10;
        });
        const tw = table.getBoundingClientRect().width;
        if (Math.abs(tw - sum) > 2) tables.push(`table ${t} (${table.dataset.widthTable}) is ${tw.toFixed(1)} px for ${sum.toFixed(1)} px of columns`);
      });
      return { cols, tables };
    });
  const before = page.viewportSize();
  const snaps: { cols: Record<string, number>; tables: string[] }[] = [];
  try {
    for (const width of widths) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
      snaps.push(await read());
    }
  } finally {
    if (before) await page.setViewportSize(before);
  }
  const [first, ...rest] = snaps;
  expect(Object.keys(first.cols).length, "no table header carries data-width-column").toBeGreaterThan(0);
  expect(first.tables, "tables wider than their columns").toEqual([]);
  for (const [i, s] of rest.entries()) {
    expect(s.cols, `column widths at ${widths[i + 1]} px differ from ${widths[0]} px`).toEqual(first.cols);
  }
  const misfits = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll<HTMLTableElement>("table[data-width-table]").forEach((table) => {
      const heads = [...table.querySelectorAll<HTMLElement>("thead th")];
      table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((tr) => {
        if (tr.cells.length !== heads.length) return; // a loading or empty row spanning the table
        [...tr.cells].forEach((td, i) => {
          const th = heads[i];
          if (th?.dataset.widthKind !== "fixed") return;
          if (td.scrollWidth > td.clientWidth + 1) out.push(`${th.dataset.widthColumn}: „${td.textContent?.trim()}" needs ${td.scrollWidth} px in ${td.clientWidth}`);
        });
      });
    });
    return out;
  });
  expect(misfits, "fixed columns whose cells do not hold their value").toEqual([]);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(first.cols)) out[k.split(":")[1]] = v;
  return out;
}

/**
 * Full-page pictures at 1366, 1920 and 2560 px into `playwright-report/layout/`
 * (`<name>-<width>.png`), for a slice's handover. Playwright empties
 * `test-results/` on every run; this folder survives it. Puts the window back.
 * (Slice #37.16; the earlier specs inline the same loop.)
 *
 * `mask` (Slice #37.22) paints over what a picture must not carry: on a screen
 * that lists the archive's own records — the dashboard, the users, a group's
 * candidates — the rows are covered and the layout is what the picture shows.
 */
export async function photograph(
  page: Page,
  name: string,
  widths: readonly number[] = [1366, 1920, 2560],
  height = 1000,
  mask: readonly Locator[] = [],
): Promise<void> {
  const before = page.viewportSize();
  try {
    for (const width of widths) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
      await page.screenshot({ path: `playwright-report/layout/${name}-${width}.png`, fullPage: true, mask: [...mask] });
    }
  } finally {
    if (before) await page.setViewportSize(before);
  }
}

/**
 * One screen of #37.22's, whole: every marked box, panel and table column is
 * exactly as wide at each width, and no fixed column's cell overflows. A screen
 * of these may have no box at all (the dashboard, Utilizatori & Acces) — so,
 * unlike `expectStableWidths`, it asks only that SOMETHING on it is marked.
 * Returns the marks it compared, for the caller's message.        (Slice #37.22)
 */
export async function expectStableScreen(
  page: Page,
  widths: readonly number[] = THREE_WIDTHS,
  height = 900,
  /** False for a screen that may legitimately show nothing marked — an empty list of requests. */
  requireMarks = true,
): Promise<number> {
  const read = () =>
    page.evaluate(() => {
      const out: Record<string, number> = {};
      const px = (el: Element) => Math.round(el.getBoundingClientRect().width * 10) / 10;
      document.querySelectorAll<HTMLElement>("[data-width-field]").forEach((el) => {
        if (el.getBoundingClientRect().width > 0) out[`box ${el.dataset.widthField}`] = px(el);
      });
      document.querySelectorAll<HTMLElement>("[data-panel]").forEach((el) => {
        if (el.getBoundingClientRect().width > 0) out[`panel ${el.dataset.panel}`] = px(el);
      });
      document.querySelectorAll<HTMLTableElement>("table[data-width-table]").forEach((table, t) => {
        table.querySelectorAll<HTMLElement>("thead th[data-width-column]").forEach((th, i) => {
          out[`table ${t} column ${i} ${th.dataset.widthColumn}`] = px(th);
        });
      });
      return out;
    });
  const before = page.viewportSize();
  const snaps: Record<string, number>[] = [];
  const overflows: string[] = [];
  try {
    for (const width of widths) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
      snaps.push(await read());
      // Nothing pushes the page sideways at a width the screen fits in.
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 0) overflows.push(`${over} px too wide at ${width}`);
    }
  } finally {
    if (before) await page.setViewportSize(before);
  }
  expect(overflows, "the page is wider than the window").toEqual([]);
  const [first, ...rest] = snaps;
  if (requireMarks) expect(Object.keys(first).length, "nothing on this screen carries a width mark").toBeGreaterThan(0);
  for (const [i, s] of rest.entries()) {
    expect(s, `widths at ${widths[i + 1]} px differ from ${widths[0]} px`).toEqual(first);
  }
  const misfits = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll<HTMLTableElement>("table[data-width-table]").forEach((table) => {
      const heads = [...table.querySelectorAll<HTMLElement>("thead th")];
      table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((tr) => {
        if (tr.cells.length !== heads.length) return;
        [...tr.cells].forEach((td, i) => {
          const th = heads[i];
          if (th?.dataset.widthKind !== "fixed") return;
          if (td.scrollWidth > td.clientWidth + 1) out.push(`${th.dataset.widthColumn} needs ${td.scrollWidth} px in ${td.clientWidth}`);
        });
      });
    });
    return out;
  });
  expect(misfits, "fixed columns whose cells do not hold their value").toEqual([]);
  return Object.keys(first).length;
}

/**
 * At each width, the tile row holds #37.17's target of small tiles (32rem, a
 * panel): two at 1366 px, three at 1920, four at 2560. Measured, not assumed:
 * the row's own width in the browser, in whole panels and the gaps between
 * them — and every small tile on the screen is exactly a panel wide at each.
 * Which tiles share a row depends on which are ticked and how wide the
 * association tables are; how many FIT does not.                 (Slice #37.23)
 */
export async function expectTilesPerRow(
  page: Page,
  expected: Readonly<Record<number, number>> = SMALL_TILES_PER_ROW,
  height = 1000,
): Promise<void> {
  await settled(page);
  const before = page.viewportSize();
  const got: Record<number, number> = {};
  const odd: string[] = [];
  try {
    for (const width of Object.keys(expected).map(Number)) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
      const m = await page.evaluate(() => {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const panel = 32 * rem;
        const gap = 1 * rem;
        const row = document.querySelector<HTMLElement>("[data-tile-row]");
        const w = row ? row.getBoundingClientRect().width : 0;
        const small = [...document.querySelectorAll<HTMLElement>("[data-tile]")]
          .map((el) => el.getBoundingClientRect().width)
          .filter((x) => x > 0 && x < panel + gap);
        return { fit: Math.floor((w + gap) / (panel + gap)), off: small.filter((x) => Math.abs(x - panel) > 1).map((x) => Math.round(x)) };
      });
      got[width] = m.fit;
      if (m.off.length) odd.push(`${width}: ${m.off.join(", ")} px`);
    }
  } finally {
    if (before) await page.setViewportSize(before);
  }
  expect(got, "small tiles that fit on one row, by window width").toEqual(expected);
  expect(odd, "small tiles that are not exactly a panel wide").toEqual([]);
}
