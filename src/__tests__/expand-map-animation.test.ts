/**
 * Slice 41.75 — „Hartă extinsă" opens in two animated parts (`@/lib/geo/expand-map-animation`): the panel grows from the
 * tile's map while the polygon travels to the middle at the tile's zoom, then the map zooms to the polygon at a tenth
 * of its height.
 */
import {
  EXPAND_DEFAULT_MS,
  atOpeningEnd,
  backdropAt,
  collapseBackdropAt,
  collapseCameraAt,
  collapsePanelAt,
  collapseTotalMs,
  collapseZooming,
  easeInOut,
  expandCameraAt,
  expandStartView,
  expandTotalMs,
  mapRectAt,
  panelRectAt,
  planCollapse,
  planExpand,
  usableExpandMs,
  zoomForHeightFraction,
  type Camera,
  type CollapseInput,
  type Corner,
  type ExpandInput,
  type LatLng,
} from "@/lib/geo/expand-map-animation";
import { cameraAt, flightPeak } from "@/lib/geo/map-search";

// About 64 m × 44 m at 45.72° N — TC-MAP-09's lot.
const LOT: Corner[] = [
  { lat: 45.72, lon: 24.44 },
  { lat: 45.72, lon: 24.4408 },
  { lat: 45.7204, lon: 24.4408 },
  { lat: 45.7204, lon: 24.44 },
];
const LOT_CENTRE = { lat: 45.7202, lng: 24.4404 };

/** World pixels at `zoom`, as the module projects (Web Mercator). */
function world(p: LatLng, zoom: number) {
  const size = 256 * 2 ** zoom;
  const sin = Math.sin((p.lat * Math.PI) / 180);
  return { x: ((p.lng + 180) / 360) * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size };
}

const input = (over: Partial<ExpandInput> = {}): ExpandInput => ({
  tileMap: { x: 900, y: 300, w: 440, h: 440 },
  viewport: { w: 1366, h: 768 },
  headerPx: 49,
  // The tile looks a little north-west of the lot, so the lot is off its centre.
  tileCenter: { lat: 45.7205, lng: 24.4399 },
  zoom: 19,
  corners: LOT,
  growMs: 3000,
  zoomMs: 3000,
  reducedMotion: false,
  ...over,
});

/** Where the lot's centre is drawn on screen at `t`: the map's centre plus the offset at the camera's zoom. */
function lotOnScreen(t: number, p: ReturnType<typeof planExpand>) {
  const cam = expandCameraAt(t, p);
  const r = mapRectAt(t, p);
  const a = world(LOT_CENTRE, cam.zoom);
  const c = world(cam.center, cam.zoom);
  return { x: r.x + r.w / 2 + (a.x - c.x), y: r.y + r.h / 2 + (a.y - c.y) };
}

describe("part 1 — the tile grows, the polygon travels to the middle at the same size", () => {
  const p = planExpand(input());

  it("the panel starts on the tile's map, its header above, and ends at inset 16 px", () => {
    expect(mapRectAt(0, p)).toEqual({ x: 900, y: 300, w: 440, h: 440 });
    expect(panelRectAt(0, p)).toEqual({ x: 900, y: 251, w: 440, h: 489 });
    expect(panelRectAt(3000, p)).toEqual({ x: 16, y: 16, w: 1334, h: 736 });
    const half = panelRectAt(1500, p);
    expect(half.x).toBeCloseTo((900 + 16) / 2, 6);
    expect(half.w).toBeCloseTo((440 + 1334) / 2, 6);
  });

  it("the camera starts where the tile looked, at the tile's zoom, and keeps that zoom", () => {
    expect(expandStartView(p)).toEqual({ center: expect.objectContaining({}), zoom: 19 });
    const c0 = expandCameraAt(0, p).center;
    expect(c0.lat).toBeCloseTo(45.7205, 7);
    expect(c0.lng).toBeCloseTo(24.4399, 7);
    for (const t of [0, 750, 1500, 2999]) expect(expandCameraAt(t, p).zoom).toBe(19);
  });

  it("the polygon's centre travels on a straight line from its place on the tile to the map's middle", () => {
    const s0 = lotOnScreen(0, p);
    const tile = world(input().tileCenter, 19);
    const lot = world(LOT_CENTRE, 19);
    expect(s0.x).toBeCloseTo(900 + 220 + (lot.x - tile.x), 6);
    expect(s0.y).toBeCloseTo(300 + 220 + (lot.y - tile.y), 6);
    const end = mapRectAt(3000, p);
    const s1 = lotOnScreen(2999.999, p);
    expect(s1.x).toBeCloseTo(end.x + end.w / 2, 2);
    expect(s1.y).toBeCloseTo(end.y + end.h / 2, 2);
    // Half way (eased): half way along the line.
    const sh = lotOnScreen(1500, p);
    expect(sh.x).toBeCloseTo((s0.x + end.x + end.w / 2) / 2, 3);
    expect(sh.y).toBeCloseTo((s0.y + end.y + end.h / 2) / 2, 3);
  });

  it("the backdrop fades in with it", () => {
    expect(backdropAt(0, p)).toBe(0);
    expect(backdropAt(1500, p)).toBeCloseTo(0.5, 6);
    expect(backdropAt(3000, p)).toBe(1);
  });
});

describe("part 2 — the zoom-out to a tenth of the map's height", () => {
  it.each([
    [1366, 768],
    [1920, 1080],
  ])("at %i × %i the lot ends centred, its height 10 %% of the map's", (w, h) => {
    const p = planExpand(input({ viewport: { w, h } }));
    expect(expandTotalMs(p)).toBe(6000);
    const end = expandCameraAt(6000, p);
    expect(end.center).toEqual(LOT_CENTRE);
    const north = world({ lat: 45.7204, lng: 0 }, end.zoom).y;
    const south = world({ lat: 45.72, lng: 0 }, end.zoom).y;
    const mapH = h - 32 - 49;
    expect((south - north) / mapH).toBeCloseTo(0.1, 6);
    // Its width inside the map.
    const wPx = world({ lat: 0, lng: 24.4408 }, end.zoom).x - world({ lat: 0, lng: 24.44 }, end.zoom).x;
    expect(wPx).toBeLessThan(w - 32);
    // Half way through part 2, the zoom half way (eased), the lot held in the middle.
    const mid = expandCameraAt(4500, p);
    expect(mid.center).toEqual(LOT_CENTRE);
    expect(mid.zoom).toBeCloseTo((19 + end.zoom) / 2, 6);
  });

  it("one rule both ways: a polygon already smaller zooms in to it", () => {
    const p = planExpand(input({ zoom: 13 }));
    expect(p.endZoom).toBeGreaterThan(13);
  });

  it("within half a zoom level, part 2 is skipped", () => {
    const fit = zoomForHeightFraction(LOT, 1334, 736 - 49)!;
    const p = planExpand(input({ zoom: fit + 0.3 }));
    expect(p.zoomMs).toBe(0);
    expect(p.endZoom).toBe(fit + 0.3);
    expect(expandTotalMs(p)).toBe(3000);
  });

  it("a width that would not fit caps the zoom: the box is held inside the map", () => {
    // A strip 1 km long and 10 m tall: 10 % of the height would make it far wider than the map.
    const strip: Corner[] = [
      { lat: 45.72, lon: 24.44 },
      { lat: 45.72009, lon: 24.453 },
    ];
    const z = zoomForHeightFraction(strip, 1334, 687)!;
    const wPx = world({ lat: 0, lng: 24.453 }, z).x - world({ lat: 0, lng: 24.44 }, z).x;
    expect(wPx).toBeCloseTo(1334 * 0.9, 3);
  });

  it("no corners, or one: nothing to zoom to", () => {
    expect(zoomForHeightFraction([], 1000, 600)).toBeNull();
    expect(zoomForHeightFraction([{ lat: 45, lon: 24 }], 1000, 600)).toBeNull();
    const p = planExpand(input({ corners: [] }));
    expect(p.zoomMs).toBe(0);
    expect(p.target).toEqual(input().tileCenter);
  });
});

describe("the lengths", () => {
  it("a part of 0 ms is skipped", () => {
    const p = planExpand(input({ growMs: 0 }));
    expect(panelRectAt(0, p)).toEqual(p.to);
    expect(expandCameraAt(0, p).center).toEqual(LOT_CENTRE);
    expect(expandCameraAt(0, p).zoom).toBe(19);
    expect(expandTotalMs(p)).toBe(3000);
  });

  it("under reduced motion it opens at the end at once", () => {
    const p = planExpand(input({ reducedMotion: true }));
    expect(expandTotalMs(p)).toBe(0);
    expect(panelRectAt(0, p)).toEqual(p.to);
    expect(expandStartView(p)).toEqual({ center: LOT_CENTRE, zoom: p.endZoom });
  });

  it("a saved value is used when it is whole ms in 0..10 s; anything else is 3,0 s", () => {
    expect([0, 1500, 10_000].map(usableExpandMs)).toEqual([0, 1500, 10_000]);
    expect([-1, 10_001, 1.5, "3000", null, undefined].map(usableExpandMs)).toEqual(Array(6).fill(EXPAND_DEFAULT_MS));
  });

  it("eases in and out", () => {
    expect([easeInOut(0), easeInOut(0.5), easeInOut(1)]).toEqual([0, 0.5, 1]);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
  });
});

// ---------------------------------------------------------------------------
// Slice 41.77 — the way back
// ---------------------------------------------------------------------------

const back = (over: Partial<CollapseInput> = {}): CollapseInput => {
  const { tileMap, ...rest } = input();
  return { ...rest, tileMap, flightMs: 4000, arc: 1, openingCut: false, ...over };
};
/** Where the opening ended: the lot in the middle at a tenth of the map's height. */
const endOf = (i: CollapseInput): Camera => {
  const p = planExpand({ ...i, tileMap: i.tileMap ?? input().tileMap });
  return { center: p.target, zoom: p.endZoom };
};
const near = (a: Camera, b: Camera) => {
  expect(a.center.lat).toBeCloseTo(b.center.lat, 9);
  expect(a.center.lng).toBeCloseTo(b.center.lng, 9);
  expect(a.zoom).toBeCloseTo(b.zoom, 9);
};

describe("the way back: the return (41.77, Ask first 2)", () => {
  it("is skipped when the map stands where the opening ended, or within 2 % and half a level of it", () => {
    const end = endOf(back());
    expect(planCollapse(back(), end).returnMs).toBe(0);
    // 1 % of the map's width east, a quarter level in.
    const w = world(end.center, end.zoom);
    const size = 256 * 2 ** end.zoom;
    const east = { lat: end.center.lat, lng: ((w.x + 0.01 * 1334) / size) * 360 - 180 };
    expect(planCollapse(back(), { center: east, zoom: end.zoom + 0.25 }).returnMs).toBe(0);
  });

  it("is taken beyond them: 3 % of the width away, or 0.6 of a level, or an opening stopped part way", () => {
    const end = endOf(back());
    const w = world(end.center, end.zoom);
    const size = 256 * 2 ** end.zoom;
    const east = { lat: end.center.lat, lng: ((w.x + 0.03 * 1334) / size) * 360 - 180 };
    expect(atOpeningEnd({ center: east, zoom: end.zoom }, end, 1334, 687)).toBe(false);
    expect(planCollapse(back(), { center: east, zoom: end.zoom }).returnMs).toBe(4000);
    expect(planCollapse(back(), { center: end.center, zoom: end.zoom - 0.6 }).returnMs).toBe(4000);
    expect(planCollapse(back({ openingCut: true }), end).returnMs).toBe(4000);
  });

  it("flies on 41.76's parabola: its camera at 0, half way and the end is cameraAt's, with the flight's length and a", () => {
    const moved: Camera = { center: { lat: 45.75, lng: 24.5 }, zoom: 12 };
    const c = planCollapse(back({ flightMs: 5000, arc: 1.5 }), moved);
    expect(c.returnMs).toBe(5000);
    expect(c.peak).toBe(flightPeak(moved, c.end, 1334, 687));
    for (const t of [0, 2500, 5000]) near(collapseCameraAt(t, c), cameraAt(t, moved, c.end, c.peak, 5000, 1.5));
    near(collapseCameraAt(5000, c), c.end);
    // The panel stays the expanded map's, the backdrop dark, the whole while.
    expect(collapsePanelAt(2500, c)).toEqual(c.expand.to);
    expect(collapseBackdropAt(2500, c)).toBe(1);
  });
});

describe("the way back: the opening's two parts in reverse (41.77, Ask first 3)", () => {
  const c = planCollapse(back(), endOf(back()));
  const p = c.expand;

  it("zooms back to the tile's zoom first, the lot held in the middle, as long as map_expand_zoom_out", () => {
    expect(c.zoomMs).toBe(3000);
    near(collapseCameraAt(0, c), { center: LOT_CENTRE, zoom: p.endZoom });
    near(collapseCameraAt(1500, c), expandCameraAt(p.growMs + 1500, p));
    near(collapseCameraAt(3000, c), { center: LOT_CENTRE, zoom: 19 });
    expect(collapseZooming(1500, c)).toBe(true);
    expect(collapsePanelAt(1500, c)).toEqual(p.to);
  });

  it("then shrinks the panel into the tile, the lot travelling back, the backdrop fading, as long as map_expand_grow", () => {
    expect(collapseTotalMs(c)).toBe(6000);
    expect(collapsePanelAt(3000, c)).toEqual(p.to);
    expect(collapsePanelAt(4500, c)).toEqual(panelRectAt(1500, p));
    expect(collapsePanelAt(6000, c)).toEqual(p.from);
    expect(collapseBackdropAt(4500, c)).toBeCloseTo(backdropAt(1500, p), 9);
    expect(collapseBackdropAt(6000, c)).toBe(0);
    near(collapseCameraAt(4500, c), expandCameraAt(1500, p));
    near(collapseCameraAt(6000, c), { center: input().tileCenter, zoom: 19 });
    // On the tile at the end: the lot back where the tile drew it.
    const end = lotOnScreen(0, p);
    const tile = world(LOT_CENTRE, 19);
    const tc = world(input().tileCenter, 19);
    expect(end.x).toBeCloseTo(900 + 220 + (tile.x - tc.x), 6);
    expect(end.y).toBeCloseTo(300 + 220 + (tile.y - tc.y), 6);
  });

  it("lands on the tile where it stands now, not where it stood at the opening", () => {
    const moved = planCollapse(back({ tileMap: { x: 900, y: 120, w: 440, h: 440 } }), endOf(back()));
    expect(collapsePanelAt(collapseTotalMs(moved), moved)).toEqual({ x: 900, y: 120 - 49, w: 440, h: 440 + 49 });
  });

  it("a part whose setting is 0 is skipped", () => {
    const noZoom = planCollapse(back({ zoomMs: 0 }), endOf(back()));
    expect(noZoom.zoomMs).toBe(0);
    expect(collapseTotalMs(noZoom)).toBe(3000);
    const noGrow = planCollapse(back({ growMs: 0 }), endOf(back()));
    expect(collapseTotalMs(noGrow)).toBe(3000);
    expect(collapsePanelAt(3000, noGrow)).toEqual(noGrow.expand.to);
  });

  it("under reduced motion it closes at once", () => {
    const moved: Camera = { center: { lat: 45.75, lng: 24.5 }, zoom: 12 };
    expect(collapseTotalMs(planCollapse(back({ reducedMotion: true }), moved))).toBe(0);
  });

  it("a tile that cannot be measured: the return still flies, then it closes", () => {
    const moved: Camera = { center: { lat: 45.75, lng: 24.5 }, zoom: 12 };
    const c2 = planCollapse(back({ tileMap: null }), moved);
    expect(c2.returnMs).toBe(4000);
    expect(c2.zoomMs + c2.growMs).toBe(0);
    expect(collapsePanelAt(4000, c2)).toEqual(c2.expand.to);
  });
});
