/**
 * The width unit, set on „Setări".                                                     (Slice 41.16)
 *
 * Adrian, 2026-10-31: „The width of the tiles is a multiple of a unit - which currently is 119 pixels. I would like
 * to have the ability to set the size of this unit on the Settings page." A whole number of px from 80 to 200,
 * 119 until changed.
 *
 * KEPT PER BROWSER, IN A COOKIE — as the theme is (40.19), not in localStorage beside the tile places. Each of
 * Adrian's machines has its own screen, which is why the places are per browser (#37.17), and a cookie is the same
 * per-browser store that the server can also read: the root layout draws `--unit` on <html> from the first byte, so a
 * screen never paints at 119 and then jumps, and server and browser draw the same widths (no hydration mismatch).
 * localStorage could only be read after the first paint. No migration: nothing is in the database.
 *
 * THE UNIT IS ONE CSS VARIABLE, `--unit` (field-widths.ts → `UNIT_CSS`). Every width drawn in units is an expression
 * of it, so setting it redraws every tile on the page at once — „Setări" redraws as soon as it is saved — and another
 * tab, whose <html> still holds the old value, takes the new one the next time a screen is displayed in it
 * (`WidthUnitSync`), as Adrian allowed: „this adjustment may be done lazy, when a certain form is first displayed".
 */
import type { CSSProperties } from "react";
import { DEFAULT_UNIT_PX, UNIT_PX_MAX, UNIT_PX_MIN, UNIT_VAR, rem, unitPxOf } from "./field-widths";

export const WIDTH_UNIT_COOKIE_NAME = "ga40-width-unit";

/** A unit is a whole number of px, 80 to 200. */
export function isWidthUnitPx(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= UNIT_PX_MIN && n <= UNIT_PX_MAX;
}

/** The unit a cookie's value names; the default for anything else — missing, not a number, out of range. */
export function widthUnitOf(value: string | undefined | null): number {
  if (!value || !/^\d+$/.test(value.trim())) return DEFAULT_UNIT_PX;
  const n = Number(value.trim());
  return isWidthUnitPx(n) ? n : DEFAULT_UNIT_PX;
}

/** What a typed value on „Setări" is: the unit, or null when it is not a whole number from 80 to 200. */
export function parseWidthUnitDraft(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return isWidthUnitPx(n) ? n : null;
}

/** `--unit`'s value for a unit: rem at 16 px to the rem, as every other width in field-widths.ts. */
export function unitVarValue(px: number): string {
  return rem(px / 16);
}

/** <html>'s style for a unit — the root layout spreads it beside `colorScheme`. */
export function widthUnitStyle(px: number): CSSProperties {
  return { [UNIT_VAR]: unitVarValue(px) } as CSSProperties;
}

export function widthUnitCookie(px: number): string {
  const oneYear = 60 * 60 * 24 * 365;
  return `${WIDTH_UNIT_COOKIE_NAME}=${px}; path=/; max-age=${oneYear}; SameSite=Lax`;
}

/** This browser's unit, from its cookie. */
export function readWidthUnit(doc: Document = document): number {
  const m = new RegExp(`(?:^|;\\s*)${WIDTH_UNIT_COOKIE_NAME}=([^;]*)`).exec(doc.cookie);
  return widthUnitOf(m?.[1]);
}

/** The unit this page is drawn at now — `--unit` on <html>. */
export function drawnWidthUnit(doc: Document = document): number {
  const value = doc.documentElement.style.getPropertyValue(UNIT_VAR);
  const px = unitPxOf(value);
  return px === null ? DEFAULT_UNIT_PX : Math.round(px);
}

/** Draw the page at `px`. */
export function drawWidthUnit(px: number, doc: Document = document): void {
  doc.documentElement.style.setProperty(UNIT_VAR, unitVarValue(px));
}

/** Keep `px` for this browser and redraw the page at it — „Salvează" on „Setări". */
export function applyWidthUnit(px: number, doc: Document = document): void {
  doc.cookie = widthUnitCookie(px);
  drawWidthUnit(px, doc);
}

/** The live unit in px, as the browser resolves `--unit` — what the tile packing measures with. */
export function liveUnitPx(remPx: number, doc: Document = document): number {
  const value = getComputedStyle(doc.documentElement).getPropertyValue(UNIT_VAR);
  return unitPxOf(value, remPx) ?? (DEFAULT_UNIT_PX / 16) * remPx;
}
