/**
 * A PAGE TURNED TO THE RIGHT, A QUARTER AT A TIME.               (Slice #38.17)
 *
 * A landscape scan lies on its side in the „Pagini" viewer. „Rotește la
 * dreapta" turns the page shown by 90° each press — 90, 180, 270, back to 0 —
 * and „Salvează rotirea" stores the turn on the page (`document_page.rotation`,
 * migration 093), so it opens turned from then on: in the tile, in „Pagini
 * extinse" and in a document's preview. The file itself is never changed: the
 * turn is a CSS rotate the viewer draws.
 *
 * FITTED, NEVER CROPPED (`fitRotated`). A quarter turn swaps the picture's
 * width and height, so the image is scaled to fit the box it is drawn in with
 * its sides swapped — and never enlarged past its own size, as the unturned
 * `max-w-full object-contain` image is not.
 *
 * Images only (#38.17's Ask first 1): a turned <iframe> turns the browser's
 * PDF toolbar and scrollbars with it, so a PDF page is never turned.
 *
 * PURE — no DOM, no React; `page-rotation.test.ts` covers it.
 */

/** The four turns a page may have, in degrees to the right. */
export const PAGE_ROTATIONS = [0, 90, 180, 270] as const;

export type PageRotation = (typeof PAGE_ROTATIONS)[number];

/** Is this one of the four turns? */
export function isPageRotation(value: unknown): value is PageRotation {
  return typeof value === "number" && (PAGE_ROTATIONS as readonly number[]).includes(value);
}

/** A stored or sent turn, read safely: anything that is not one of the four is no turn. */
export function rotationOf(value: unknown): PageRotation {
  return isPageRotation(value) ? value : 0;
}

/** „Rotește la dreapta": a quarter turn more — 0 → 90 → 180 → 270 → 0. */
export function nextRotation(rotation: PageRotation): PageRotation {
  return ((rotation + 90) % 360) as PageRotation;
}

/** A quarter turn either way lays the picture across: its width and height swap. */
export function isAcross(rotation: PageRotation): boolean {
  return rotation === 90 || rotation === 270;
}

export interface Size {
  width: number;
  height: number;
}

/** Where a turned picture is drawn: the box it takes on screen, and the image's own size before the turn. */
export interface RotatedFit {
  boxWidth: number;
  boxHeight: number;
  imageWidth: number;
  imageHeight: number;
}

/**
 * The turned picture fitted into `room` (its height may be Infinity — a box
 * that grows with its content): scaled down until the turned picture fits,
 * never up past its natural size, never cropped.
 */
export function fitRotated(natural: Size, room: Size, rotation: PageRotation): RotatedFit {
  const across = isAcross(rotation);
  const shownWidth = across ? natural.height : natural.width;
  const shownHeight = across ? natural.width : natural.height;
  if (!(shownWidth > 0 && shownHeight > 0)) return { boxWidth: 0, boxHeight: 0, imageWidth: 0, imageHeight: 0 };
  const roomWidth = room.width > 0 ? room.width : shownWidth;
  const roomHeight = room.height > 0 ? room.height : shownHeight;
  const scale = Math.min(1, roomWidth / shownWidth, roomHeight / shownHeight);
  return {
    boxWidth: shownWidth * scale,
    boxHeight: shownHeight * scale,
    imageWidth: natural.width * scale,
    imageHeight: natural.height * scale,
  };
}
