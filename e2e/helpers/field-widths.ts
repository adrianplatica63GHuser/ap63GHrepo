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

import { expect, type Page } from "@playwright/test";

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
export async function expectStableWidths(page: Page, widths: readonly number[] = [1400, 2400], height = 900): Promise<WidthSnapshot> {
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
