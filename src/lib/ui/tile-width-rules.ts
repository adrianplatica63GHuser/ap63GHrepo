/**
 * When a tile's width cannot be had, or is a bad idea — and why.                         (Slice 41.18)
 *
 * Adrian, 2026-10-31: „If the action of me grabbing the right edge of a tile and making it smaller or bigger is not
 * possible: the system should tell me so and why; and if the same action is possible but is a bad idea (creates
 * undesired consequences of size) I should also be advised by the system during my attempt".
 *
 * One pure function (Ask first 4): the width the pointer — or a key — asks for, and what the screen measured, in;
 * „ok", „refused" with its reason, or „advised" with what the width will cost, out. The handle (use-tile-packing.ts)
 * measures and shows; this decides, and `tile-width-rules.test.ts` pins each reason.
 *
 * PURE — no DOM, no React.
 */

/** Not possible (Ask first 1): the edge stops at the last width the tile can have and turns red. */
export type WidthRefusal =
  /** (a) Narrower than its content: the widest row of fixed boxes, its fields and the px the tile needs for it. */
  | { reason: "content"; units: number; fields: string; px: number }
  /** (b) Wider than this window's row holds — or than reaches a tile that holds still beside it. */
  | { reason: "window"; units: number }
  /** (c) Under one unit. */
  | { reason: "one" }
  /** 41.19: a shared tile narrower than its content on another form — that form named. */
  | { reason: "form"; units: number; form: string };

/** Possible but a bad idea (Ask first 2): the edge turns amber, the width is taken, and the cost is said. */
export type WidthAdvice =
  /** (a) Two units or more wider than its content needs: empty room on the right of its fields. */
  | { reason: "room"; spare: number }
  /** (b) So wide that a tile that stood beside it goes under it. */
  | { reason: "alone"; title: string }
  /** (c) Wider than a 1366-px window holds beside the sidebar on this unit: on the laptop it falls back. */
  | { reason: "laptop"; units: number }
  /** (d) A list tile narrower than its table's columns: the table scrolls sideways. */
  | { reason: "table" };

export type WidthVerdict =
  | { kind: "ok" }
  | { kind: "refused"; refusal: WidthRefusal }
  | { kind: "advised"; advice: WidthAdvice[] };

export interface WidthCase {
  /** The width asked for, in whole units, before any limit — under 1 or past the row when the pointer is. */
  asked: number;
  /** The narrowest and widest the tile can be (`widthLimits`, tile-positions.ts). */
  min: number;
  max: number;
  /** What sets `min` when it is the content: the widest row's fields and the px the tile needs to hold it. */
  widest?: { fields: string; px: number };
  /** 41.19: when `min` is set by a shared tile's content on another form, that form (`formOfEntity`). */
  elsewhere?: string;
  /** The units its content needs — `min` before its own width is counted. */
  contentUnits: number;
  /** It holds fixed boxes (fields); a tile of only text and lists has no „room on the right of its fields". */
  hasFields: boolean;
  /** A list tile: the units its table's columns need. */
  tableUnits?: number;
  /** The tiles beside it now, on its right: where each starts, and its name. */
  beside: readonly { col: number; title: string }[];
  /** The tile's first column. */
  col: number;
  /** The units a 1366-px window holds beside the sidebar on the current unit (`laptopUnits`). */
  laptopUnits: number;
}

/** A 1366-px window's row beside the sidebar: less the sidebar's 248 px and the page's 24 px a side. */
export const LAPTOP_ROW_PX = 1366 - 248 - 2 * 24;

/** The units a 1366-px window holds beside the sidebar — 8 on 119 px (40.98). */
export function laptopUnits(unitPx: number, gapPx: number): number {
  return Math.max(1, Math.floor((LAPTOP_ROW_PX + gapPx) / (unitPx + gapPx) + 1e-9));
}

export function judgeWidth(c: WidthCase): WidthVerdict {
  if (c.asked < 1) return { kind: "refused", refusal: { reason: "one" } };
  if (c.asked < c.min) {
    if (c.elsewhere) return { kind: "refused", refusal: { reason: "form", units: c.min, form: c.elsewhere } };
    return c.widest
      ? { kind: "refused", refusal: { reason: "content", units: c.min, fields: c.widest.fields, px: Math.round(c.widest.px) } }
      : { kind: "refused", refusal: { reason: "one" } };
  }
  if (c.asked > c.max) return { kind: "refused", refusal: { reason: "window", units: c.max } };
  const n = c.asked;
  const advice: WidthAdvice[] = [];
  if (c.hasFields && n - c.contentUnits >= 2) advice.push({ reason: "room", spare: n - c.contentUnits });
  const under = c.beside.find((b) => c.col + n > b.col);
  if (under) advice.push({ reason: "alone", title: under.title });
  if (n > c.laptopUnits) advice.push({ reason: "laptop", units: c.laptopUnits });
  if (c.tableUnits !== undefined && n < c.tableUnits) advice.push({ reason: "table" });
  return advice.length > 0 ? { kind: "advised", advice } : { kind: "ok" };
}
