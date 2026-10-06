/**
 * Slice #38.12 — the group screen (Administrare → Grupuri → a group): three
 * named tiles — „Identitatea grupului", „Membri disponibili pentru includere",
 * „Deja în grup" — on the record forms' packing and drag (`useTilePacking`
 * through `TileUnitRow`), stored under the screen's own key; by default „Deja
 * în grup" under „Identitatea grupului", „Membri disponibili…" at their right,
 * at every width where two columns fit; „Implicit" at the top right puts them
 * back. jsdom has no layout: the placement is checked on the pure rule the hook
 * runs, with the flow held as the hook holds it.
 */
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "fs";
import { join } from "path";

import { GroupEditor } from "@/app/admin/groups/_components/group-editor";
import { resetTilePositions } from "@/components/screen/tile-positions-reset";
import { GROUP_SCREEN } from "@/lib/ui/screen-tiles";
import { placeWithStored } from "@/lib/ui/tile-positions";
import { TILE_POSITIONS_RESET, tilePositionsKey } from "@/lib/ui/tile-positions";
import { columnsIn } from "@/lib/ui/tile-packing";
import { UNIT_GAP_REM, UNIT_REM } from "@/lib/ui/field-widths";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join("|")}` : key,
}));
jest.mock("@/components/help/help-hint", () => ({ HelpHint: () => null }));

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const DETAIL = {
  id: "g1",
  code: "GRP-001",
  targetType: "PROPERTY" as const,
  description: "TC-GRP-04 Grup de test",
  members: [
    { memberId: "a", position: 1, displayLabel: "Teren A" },
    { memberId: "b", position: 2, displayLabel: "Teren B" },
  ],
  candidates: [{ id: "c", displayLabel: "Teren C", otherGroupCount: 0 }],
};

function renderEditor() {
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, redirected: false, json: async () => DETAIL })) as unknown as typeof fetch;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GroupEditor groupId="g1" initialDetail={DETAIL} />
    </QueryClientProvider>,
  );
}

describe("the group screen's three tiles (#38.12)", () => {
  it("three regions named by their titles, each a tile of the screen's row in reading order; the lists keep their counts", () => {
    const { container } = renderEditor();
    const identity = screen.getByRole("region", { name: "panels.identity" });
    const available = screen.getByRole("region", { name: "panels.available" });
    const inGroup = screen.getByRole("region", { name: "panels.inGroup" });
    expect([identity, available, inGroup].map((e) => e.dataset.tile)).toEqual([...GROUP_SCREEN.tiles]);
    const row = container.querySelector<HTMLElement>("[data-tile-row]")!;
    expect(row.dataset.tileScreen).toBe("admin-group");
    expect([...row.querySelectorAll<HTMLElement>("[data-tile]")].map((e) => e.dataset.tile)).toEqual(["identity", "available", "in-group"]);
    // The counts: one candidate available, two in the group.
    expect(available.querySelector("span.text-xs")?.textContent).toBe("1");
    expect(inGroup.querySelector("span.text-xs")?.textContent).toBe("2");
    // The identity tile still holds the target, the code, the description and „Salvează".
    expect(identity.textContent).toContain("GRP-001");
    expect(identity.querySelector("textarea")).not.toBeNull();
  });

  it("the titles, in both languages — Adrian's English, the run's Romanian", () => {
    const ro = JSON.parse(read("messages", "ro-RO.json")).group.panels;
    const en = JSON.parse(read("messages", "en-GB.json")).group.panels;
    expect([ro.identity, ro.available, ro.inGroup]).toEqual(["Identitatea grupului", "Membri disponibili pentru includere", "Deja în grup"]);
    expect([en.identity, en.available, en.inGroup]).toEqual(["Group identity", "Members available to include", "In Group already"]);
  });
});

describe("the default placement (#38.12)", () => {
  const remPx = 16;
  const unit = UNIT_REM * remPx;
  const gap = UNIT_GAP_REM * remPx;
  // The heights measured on a synthetic group of two in the browser pane.
  const boxes = [
    { id: "identity", units: 3, height: 304 },
    { id: "available", units: 3, height: 511 },
    { id: "in-group", units: 3, height: 165 },
  ];
  /** What the hook runs for a row `units` wide: the flow held to `flowUnits`, the row's whole width free. */
  const at = (units: number) => {
    const own = columnsIn(units * unit + (units - 1) * gap, unit, gap);
    const flow = Math.min(own, GROUP_SCREEN.flowUnits);
    return Object.fromEntries(placeWithStored(boxes, {}, own, gap, flow).placed.map((p) => [p.id, [p.col, p.top]]));
  };

  it.each([6, 10, 14])("a row of %i units: „Deja în grup” under „Identitatea grupului”, „Membri disponibili…” at their right", (units) => {
    expect(at(units)).toEqual({ identity: [0, 0], available: [3, 0], "in-group": [0, 304 + gap] });
  });

  it("without the held flow, a wide row would put the three in one line — which is why the screen holds it", () => {
    const own = 10;
    const placed = Object.fromEntries(placeWithStored(boxes, {}, own, gap).placed.map((p) => [p.id, p.col]));
    expect(placed["in-group"]).toBe(6);
  });

  it("a dragged „Deja în grup” keeps its stored place in the free space at the right", () => {
    const own = 10;
    const placed = placeWithStored(boxes, { "in-group": { col: 6, top: 0 } }, own, gap, GROUP_SCREEN.flowUnits).placed;
    expect(placed.find((p) => p.id === "in-group")).toMatchObject({ col: 6, top: 0 });
  });
});

describe("positions under the group screen's own key (#38.12)", () => {
  it("ga40-tile-positions-admin-group-v1", () => {
    expect(tilePositionsKey(GROUP_SCREEN.entity)).toBe("ga40-tile-positions-admin-group-v1");
  });

  it("„Implicit” forgets that key, and only that key, and tells the row", () => {
    localStorage.setItem("ga40-tile-positions-admin-group-v1", '{"in-group":{"col":6,"top":0}}');
    localStorage.setItem("ga40-tile-positions-natural-person-v1", "{}");
    const heard: string[] = [];
    const listen = (e: Event) => heard.push((e as CustomEvent<string>).detail);
    window.addEventListener(TILE_POSITIONS_RESET, listen);
    act(() => resetTilePositions(GROUP_SCREEN.entity));
    window.removeEventListener(TILE_POSITIONS_RESET, listen);
    expect(localStorage.getItem("ga40-tile-positions-admin-group-v1")).toBeNull();
    expect(localStorage.getItem("ga40-tile-positions-natural-person-v1")).toBe("{}");
    expect(heard).toEqual(["admin-group"]);
  });

  it("the forms' mechanism, not a copy: the row packs through useTilePacking, the reset sends the forms' event", () => {
    expect(read("src", "components", "screen", "tile-unit-row.tsx")).toContain("useTilePacking(ref, { entity: screen.entity, flowUnits: screen.flowUnits })");
    expect(read("src", "app", "admin", "groups", "_components", "group-editor.tsx")).toContain("<TileUnitRow screen={GROUP_SCREEN}>");
    const page = read("src", "app", "admin", "groups", "[id]", "page.tsx");
    expect(page).toContain("<TilePositionsReset entity={GROUP_SCREEN.entity} />");
    // At the screen's top right: in the header, after the title, the header spread across.
    expect(page).toMatch(/<header className="[^"]*justify-between[^"]*">\s*<h1[\s\S]*<\/h1>\s*<TilePositionsReset/);
  });
});
