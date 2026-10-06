/**
 * Slice #38.17 — „Pagini": a page turned to the right, a quarter at a time.
 * The pure half: the cycle, reading a stored turn, and fitting a turned
 * picture into its box without cropping it.
 */
import { PAGE_ROTATIONS, fitRotated, isAcross, isPageRotation, nextRotation, rotationOf } from "@/lib/documents/page-rotation";

describe("the turn", () => {
  it("cycles 0 → 90 → 180 → 270 → 0", () => {
    const seen = [0 as const];
    let r = nextRotation(0);
    while (r !== 0) {
      seen.push(r as never);
      r = nextRotation(r);
    }
    expect(seen).toEqual([0, 90, 180, 270]);
    expect(PAGE_ROTATIONS).toEqual([0, 90, 180, 270]);
  });

  it("is one of the four, or no turn at all", () => {
    for (const r of PAGE_ROTATIONS) expect(isPageRotation(r)).toBe(true);
    for (const v of [45, -90, 360, "90", null, undefined, 90.5, Number.NaN]) {
      expect({ v, ok: isPageRotation(v), read: rotationOf(v) }).toEqual({ v, ok: false, read: 0 });
    }
    expect(rotationOf(270)).toBe(270);
  });

  it("a quarter turn either way lays the picture across", () => {
    expect(PAGE_ROTATIONS.map(isAcross)).toEqual([false, true, false, true]);
  });
});

describe("fitted into its box, never cropped", () => {
  const landscape = { width: 2000, height: 1000 };

  it("a landscape scan turned upright is scaled down until its new height fits", () => {
    // Shown 1000 × 2000 in a 500 × 600 box: 600 / 2000 = 0.3.
    expect(fitRotated(landscape, { width: 500, height: 600 }, 90)).toEqual({ boxWidth: 300, boxHeight: 600, imageWidth: 600, imageHeight: 300 });
    expect(fitRotated(landscape, { width: 500, height: 600 }, 270)).toEqual(fitRotated(landscape, { width: 500, height: 600 }, 90));
  });

  it("upside down keeps its sides, and fits as the unturned image does", () => {
    expect(fitRotated(landscape, { width: 500, height: 600 }, 180)).toEqual({ boxWidth: 500, boxHeight: 250, imageWidth: 500, imageHeight: 250 });
  });

  it("is never enlarged past its own size", () => {
    expect(fitRotated({ width: 300, height: 200 }, { width: 1200, height: 900 }, 90)).toEqual({ boxWidth: 200, boxHeight: 300, imageWidth: 300, imageHeight: 200 });
  });

  it("a box that grows with its content fits the width alone", () => {
    expect(fitRotated(landscape, { width: 400, height: Infinity }, 90)).toEqual({ boxWidth: 400, boxHeight: 800, imageWidth: 800, imageHeight: 400 });
  });

  it("the turned picture always fits: box within the room, image's sides swapped into it", () => {
    for (const room of [{ width: 333, height: 777 }, { width: 900, height: 250 }, { width: 1, height: 1 }]) {
      for (const r of PAGE_ROTATIONS) {
        const f = fitRotated(landscape, room, r);
        expect(f.boxWidth).toBeLessThanOrEqual(room.width + 1e-9);
        expect(f.boxHeight).toBeLessThanOrEqual(room.height + 1e-9);
        expect(isAcross(r) ? [f.imageHeight, f.imageWidth] : [f.imageWidth, f.imageHeight]).toEqual([f.boxWidth, f.boxHeight]);
      }
    }
  });

  it("an image whose size is not known yet takes no room", () => {
    expect(fitRotated({ width: 0, height: 0 }, { width: 500, height: 600 }, 90)).toEqual({ boxWidth: 0, boxHeight: 0, imageWidth: 0, imageHeight: 0 });
  });
});
