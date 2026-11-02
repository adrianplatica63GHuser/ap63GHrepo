/**
 * 41.42: two tiles now — the compact identity and „Membrii grupului", the two lists in one tile (first describe).
 *
 * Slice #38.12 — the group screen (Administrare → Grupuri → a group): three
 * named tiles — „Identitatea grupului", „Membri disponibili pentru includere",
 * „Deja în grup" — on the record forms' packing and drag (`useTilePacking`
 * through `TileUnitRow`), stored under the screen's own key; by default „Deja
 * în grup" under „Identitatea grupului", „Membri disponibili…" at their right,
 * at every width where two columns fit; „Implicit" at the top right puts them
 * back. jsdom has no layout: the placement is checked on the pure rule the hook
 * runs, with the flow held as the hook holds it.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "fs";
import { join } from "path";

import { GroupEditor } from "@/app/admin/groups/_components/group-editor";
import { resetTilePositions } from "@/components/screen/tile-positions-reset";
import { GROUP_REGISTRY, GROUP_SCREEN } from "@/lib/ui/screen-tiles";
import { parseStoredTiles } from "@/lib/ui/tiles";
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

// 41.42 — inverted in place. Until 41.42 the screen had three tiles of 4 units: „Identitatea grupului", „Membri
// disponibili pentru includere" and „Deja în grup", the third under the first. Now two: the identity, compact at 2 units,
// and „Membrii grupului" — the two lists in one tile of 7 (src/components/screen/two-lists.tsx).
describe("the group screen's two tiles (41.42)", () => {
  it("two regions named by their titles, in reading order; the members tile holds both lists, each with its count", () => {
    const { container } = renderEditor();
    const identity = screen.getByRole("region", { name: "panels.identity" });
    const members = screen.getByRole("region", { name: "panels.members" });
    // 41.44: and „Cum lucrezi cu grupurile" after them.
    const workflows = screen.getByRole("region", { name: "title" });
    expect([identity, members, workflows].map((e) => e.dataset.tile)).toEqual([...GROUP_SCREEN.tiles]);
    expect(GROUP_SCREEN.tiles).toEqual(["identity", "members", "workflows"]);
    const row = container.querySelector<HTMLElement>("[data-tile-row]")!;
    expect(row.dataset.tileScreen).toBe("admin-group");
    expect([...row.querySelectorAll<HTMLElement>("[data-tile]")].map((e) => e.dataset.tile)).toEqual(["identity", "members", "workflows"]);
    // „Deja în grup" on the left, the available members on the right; the counts in their headings.
    const inGroup = within(members).getByRole("region", { name: "panels.inGroup" });
    const available = within(members).getByRole("region", { name: "panels.available" });
    expect([...members.querySelectorAll<HTMLElement>("[data-two-list]")].map((e) => e.dataset.twoList)).toEqual(["in-group", "available"]);
    expect(inGroup.querySelector("[data-two-list-count]")?.textContent).toBe("2");
    expect(available.querySelector("[data-two-list-count]")?.textContent).toBe("1");
    expect(within(available).getByRole("searchbox", { name: "searchPlaceholder" })).toBeTruthy();
  });

  it("the identity tile is compact: the code and the target on one line, the description, „Salvează grupul” at its foot; no toggle", () => {
    renderEditor();
    const identity = screen.getByRole("region", { name: "panels.identity" });
    expect(identity.querySelector("[data-group-identity-line]")?.textContent).toBe("GRP-001 · targets.PROPERTY");
    expect(identity.querySelector("textarea")).not.toBeNull();
    expect(identity.lastElementChild?.lastElementChild?.matches("[data-group-save]")).toBe(true);
    expect(within(identity).getByRole("button", { name: "saveGroup" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^(addItems|hideItems)$/ })).toBeNull();
    // 2 units and 7: the row is never narrower than the members' tile.
    expect(GROUP_SCREEN.tileUnits).toEqual({ identity: 2, members: 7, workflows: 7 }); // 41.44: the workflows tile
    expect(GROUP_SCREEN.units).toBe(7);
    expect(GROUP_SCREEN.flowUnits).toBe(9);
  });

  it("a double-click moves a candidate in, marked „în așteptare” until „Salvează grupul”, which then can be pressed", () => {
    renderEditor();
    const members = screen.getByRole("region", { name: "panels.members" });
    const save = screen.getByRole("button", { name: "saveGroup" });
    expect(save).toBeDisabled();
    const c = members.querySelector<HTMLElement>('[data-two-list="available"] [data-two-list-row="c"]')!;
    fireEvent.doubleClick(c);
    const moved = members.querySelector<HTMLElement>('[data-two-list="in-group"] [data-two-list-row="c"]');
    expect(moved).not.toBeNull();
    expect(moved!.hasAttribute("data-pending")).toBe(true);
    expect(moved!.textContent).toContain("pending");
    // The saved members keep their positions.
    expect(members.querySelector('[data-two-list-row="a"]')?.textContent).toContain("[01]");
    expect(save).not.toBeDisabled();
  });

  it("the titles, in both languages — Adrian's English, the run's Romanian", () => {
    const ro = JSON.parse(read("messages", "ro-RO.json")).group;
    const en = JSON.parse(read("messages", "en-GB.json")).group;
    expect([ro.panels.identity, ro.panels.members, ro.panels.inGroup, ro.panels.available]).toEqual(["Identitatea grupului", "Membrii grupului", "Deja în grup", "Membri disponibili pentru includere"]);
    expect([en.panels.identity, en.panels.members, en.panels.inGroup, en.panels.available]).toEqual(["Group identity", "Group members", "In Group already", "Members available to include"]);
    expect([ro.include, ro.takeOut]).toEqual(["‹ Include ({count})", "Scoate › ({count})"]);
    for (const k of ["addItems", "hideItems", "addToGroup", "removeFromGroup", "pendingPosition"]) expect([k, ro[k], en[k]]).toEqual([k, undefined, undefined]);
  });
});

describe("the default placement (41.42; #38.12's rule)", () => {
  const remPx = 16;
  const unit = UNIT_REM * remPx;
  const gap = UNIT_GAP_REM * remPx;
  // Synthetic heights: the compact identity and the two lists.
  const boxes = [
    { id: "identity", units: GROUP_SCREEN.tileUnits!.identity, height: 230 },
    { id: "members", units: GROUP_SCREEN.tileUnits!.members, height: 520 },
  ];
  const at = (units: number, stored = {}) => {
    const own = Math.max(columnsIn(units * unit + (units - 1) * gap, unit, gap), GROUP_SCREEN.units);
    const flow = Math.min(own, GROUP_SCREEN.flowUnits);
    return Object.fromEntries(placeWithStored(boxes, stored, own, gap, flow).placed.map((p) => [p.id, [p.col, p.top]]));
  };

  it("1366 px (8 units): the members under the identity", () => {
    expect(at(8)).toEqual({ identity: [0, 0], members: [0, 230 + gap] });
  });

  it.each([12, 17])("a row of %i units: the members at the identity's right", (units) => {
    expect(at(units)).toEqual({ identity: [0, 0], members: [2, 0] });
  });

  it("a place stored under „available” or „in-group” names no tile any more and is not read", () => {
    expect(at(12, { available: { col: 8, top: 0 }, "in-group": { col: 4, top: 0 } })).toEqual({ identity: [0, 0], members: [2, 0] });
  });

  it("a choice stored under the old names reads as „members”", () => {
    expect(parseStoredTiles(JSON.stringify(["identity", "in-group"]), GROUP_REGISTRY)).toEqual(["identity", "members"]);
    expect(parseStoredTiles(JSON.stringify(["available"]), GROUP_REGISTRY)).toEqual(["members"]);
  });
});

describe("positions under the group screen's own key (#38.12)", () => {
  it("ga40-tile-positions-admin-group-v1", () => {
    expect(tilePositionsKey(GROUP_SCREEN.entity)).toBe("ga40-tile-positions-admin-group-v1");
  });

  it("„Implicit” forgets that key, and only that key, and tells the row", () => {
    localStorage.setItem("ga40-tile-positions-admin-group-v1", '{"members":{"col":6,"top":0}}');
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
    expect(read("src", "components", "screen", "tile-unit-row.tsx")).toContain("useTilePacking(ref, { entity: screen.entity, flowUnits: screen.flowUnits, words })");
    expect(read("src", "app", "admin", "groups", "_components", "group-editor.tsx")).toContain("<TileUnitRow screen={GROUP_SCREEN}>");
    const page = read("src", "app", "admin", "groups", "[id]", "page.tsx");
    // Inverted by 41.41 — was: „<TilePositionsReset entity={GROUP_SCREEN.entity} />" at the header's top right.
    // „Implicit" is now in „Panouri" (useTileChoice's reset, which also forgets the places and sends the same event).
    expect(page).not.toContain("TilePositionsReset");
    expect(read("src", "app", "admin", "groups", "_components", "group-editor.tsx")).toContain("<AdminTilesBar registry={GROUP_REGISTRY}");
  });
});
