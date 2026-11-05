/**
 * Slice 41.88 — „Pagini extinse" grows out of the „Pagini" tile as „Hartă extinsă" grows out of the map tile, and
 * „Restrânge" takes it back (`@/lib/documents/expand-page-animation`, on `@/lib/ui/expand-animation`).
 */
import {
  FIT_VIEW,
  atFit,
  pageBackdropAt,
  pageCollapseBackdropAt,
  pageCollapsePanelAt,
  pageCollapseTotalMs,
  pageCollapseViewAt,
  pageExpandTotalMs,
  pagePanelAt,
  pageRectAt,
  pageScaleAt,
  planPageCollapse,
  planPageExpand,
  type PageCollapseInput,
  type PageExpandInput,
} from "@/lib/documents/expand-page-animation";
import { EXPAND_INSET_PX } from "@/lib/ui/expand-animation";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// A 1366 × 768 window: the tile's viewer 616 × 420 at the right, the page 300 × 400 in it; the big viewer's fit
// 495 × 660 — the same 3 : 4 — in the middle of a 1310 × 663 viewer (the body less its 12-px padding).
const input = (over: Partial<PageExpandInput> = {}): PageExpandInput => ({
  tileBox: { x: 700, y: 300, w: 616, h: 420 },
  tilePage: { x: 858, y: 310, w: 300, h: 400 },
  viewport: { w: 1366, h: 768 },
  headerPx: 49,
  padPx: 12,
  fit: { x: 435, y: 78, w: 495, h: 660 },
  growMs: 3000,
  zoomMs: 3000,
  reducedMotion: false,
  ...over,
});
const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

describe("41.88 — the opening, part 1: the panel from the tile's viewer, the page to the middle at its tile size", () => {
  it("starts with its viewer on the tile's (the body its padding larger, the header above), ends at inset-4", () => {
    const p = planPageExpand(input());
    expect(pagePanelAt(0, p)).toEqual({ x: 688, y: 239, w: 640, h: 493 });
    expect(pagePanelAt(3000, p)).toEqual({ x: EXPAND_INSET_PX, y: EXPAND_INSET_PX, w: 1334, h: 736 });
    expect(p.viewer).toEqual({ x: 28, y: 77, w: 1310, h: 663 });
    expect([pageBackdropAt(0, p), pageBackdropAt(3000, p)]).toEqual([0, 1]);
  });
  it("the page where it stood on the tile at 0, half way along the line at half time, in the middle at the end — its size kept", () => {
    const p = planPageExpand(input());
    const at0 = pageRectAt(0, p)!;
    expect(at0.x).toBeCloseTo(858, 6);
    expect(at0.y).toBeCloseTo(310, 6);
    expect(at0.w).toBeCloseTo(300, 6);
    const end = pageRectAt(3000, p)!;
    expect(mid(end).x).toBeCloseTo(mid(input().fit!).x, 6);
    expect(mid(end).y).toBeCloseTo(mid(input().fit!).y, 6);
    expect(end.w).toBeCloseTo(300, 6);
    const half = mid(pageRectAt(1500, p)!);
    expect(half.x).toBeCloseTo((mid(at0).x + mid(end).x) / 2, 6);
    expect(half.y).toBeCloseTo((mid(at0).y + mid(end).y) / 2, 6);
  });
});

describe("41.88 — the opening, part 2: the page from its tile size to its fit", () => {
  it("ends at the fit — the viewer's rest", () => {
    const p = planPageExpand(input());
    expect(pageScaleAt(6000, p)).toBeCloseTo(1, 9);
    expect(pageRectAt(6000, p)).toEqual(expect.objectContaining({ w: expect.closeTo(495, 6), h: expect.closeTo(660, 6) }));
    expect(pageExpandTotalMs(p)).toBe(6000);
  });
  it("half way, the geometric middle of the two sizes", () => {
    const p = planPageExpand(input());
    expect(pageScaleAt(4500, p)).toBeCloseTo(Math.sqrt(300 / 495), 6);
  });
  it("a PDF or a download prompt has no page to move and no part 2: its box grows with the panel", () => {
    const p = planPageExpand(input({ tilePage: null, fit: null }));
    expect(p.zoomMs).toBe(0);
    expect(pageExpandTotalMs(p)).toBe(3000);
    expect(pageRectAt(1500, p)).toBeNull();
  });
  it("0 ms skips a part; reduced motion opens at the end at once", () => {
    expect(pageExpandTotalMs(planPageExpand(input({ zoomMs: 0 })))).toBe(3000);
    const off = planPageExpand(input({ reducedMotion: true }));
    expect(pageExpandTotalMs(off)).toBe(0);
    expect(pagePanelAt(0, off)).toEqual(off.to);
    expect(pageScaleAt(0, off)).toBe(1);
  });
});

const collapse = (over: Partial<PageCollapseInput> = {}): PageCollapseInput => ({ ...input(), current: FIT_VIEW, flightMs: 4000, arc: 1, ...over });

describe("41.88 — the way back", () => {
  it("at the fit: no return — part 2 backwards, then part 1 backwards into the tile", () => {
    const c = planPageCollapse(collapse());
    expect(c.returnMs).toBe(0);
    expect(pageCollapseTotalMs(c)).toBe(6000);
    expect(pageCollapseViewAt(3000, c).scale).toBeCloseTo(300 / 495, 9);
    expect(pageCollapsePanelAt(6000, c)).toEqual(pagePanelAt(0, c.expand));
    expect([pageCollapseBackdropAt(0, c), pageCollapseBackdropAt(6000, c)]).toEqual([1, 0]);
  });
  it("zoomed or panned: the return to the fit comes first, on the parabola", () => {
    const zoomed = { scale: 2.5, tx: -400, ty: -300 };
    const c = planPageCollapse(collapse({ current: zoomed }));
    expect(c.returnMs).toBe(4000);
    expect(pageCollapseViewAt(0, c).scale).toBeCloseTo(2.5, 9);
    expect(pageCollapseViewAt(4000, c)).toEqual(expect.objectContaining({ scale: expect.closeTo(1, 9) }));
    expect(pageCollapseViewAt(2000, c).scale).toBeLessThan(Math.sqrt(2.5));
    expect(planPageCollapse(collapse({ current: { scale: 1, tx: 60, ty: 0 } })).returnMs).toBe(4000);
  });
  it("inside the tolerance there is no return", () => {
    expect(atFit({ scale: 1.005, tx: 10, ty: -5 }, { w: 1310, h: 663 })).toBe(true);
    expect(planPageCollapse(collapse({ current: { scale: 1, tx: 10, ty: 0 } })).returnMs).toBe(0);
  });
  it("a tile that cannot be measured gets the return alone", () => {
    const c = planPageCollapse(collapse({ tileBox: null, current: { scale: 2, tx: 0, ty: 0 } }));
    expect([c.returnMs, c.zoomMs, c.growMs]).toEqual([4000, 0, 0]);
  });
  it("reduced motion: nothing plays", () => {
    expect(pageCollapseTotalMs(planPageCollapse(collapse({ reducedMotion: true, current: { scale: 2, tx: 0, ty: 0 } })))).toBe(0);
  });
});

describe("41.88 — the overlay plays it, with the shared module", () => {
  const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
  it("document-form draws the theater's overlay, and the theater reads the shared clock", () => {
    const form = read("src", "app", "documents", "_components", "document-form.tsx");
    expect(form).toMatch(/usePagesTheater\(\{ state: pagesState/);
    expect(form).not.toMatch(/ga-theater-in 180ms/);
    const theater = read("src", "app", "documents", "_components", "pages-theater.tsx");
    expect(theater).toMatch(/playTimeline\(/);
    expect(theater).toMatch(/from "@\/lib\/ui\/expand-animation"/);
    expect(theater).toMatch(/expandDurations\(\)/);
    expect(theater).toMatch(/searchFlightSetting\(\)/);
  });
});
