/**
 * Slice 40.40 — „Toate sus" in the tile bar, left of „Toate", on the four record screens only.
 *
 * The bar draws the button when told to (`allUp`), and pressing it asks the tile choice to send TILES_ALL_UP for its
 * kind of record — the packing hook does the moving (tile-positions.test.ts covers `allUp` itself). Setări's bar does
 * not get it. Slice 41.02: the home page does — its tiles are laid out by the same packing (`TileAreas`, entity `home`).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";

import { TileSelector } from "@/components/tiles/tile-selector";
import { useTileChoice, type TileChoice } from "@/components/tiles/use-tile-choice";
import { TILES_ALL_UP } from "@/lib/ui/tile-positions";
import type { TileRegistry } from "@/lib/ui/tiles";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
jest.mock("@/components/help/help-hint", () => ({ HelpHint: () => null }));

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

type K = "a" | "b";
const ALL: readonly K[] = ["a", "b"];
const LABELS: Record<K, string> = { a: "Unu", b: "Doi" };

function fakeChoice(): TileChoice<K> {
  return { shown: ["a", "b"], isShown: () => true, toggle: jest.fn(), showAll: jest.fn(), reset: jest.fn(), reveal: jest.fn(), allUp: jest.fn() };
}

describe("„Toate sus” (40.40)", () => {
  it("is drawn left of „Toate” when asked for, and presses choice.allUp", () => {
    const choice = fakeChoice();
    render(<TileSelector all={ALL} labels={LABELS} choice={choice} allUp />);
    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual(["allUp", "all", "defaults"]);
    fireEvent.click(screen.getByRole("button", { name: "allUp" }));
    expect(choice.allUp).toHaveBeenCalledTimes(1);
  });

  it("is not drawn without it", () => {
    render(<TileSelector all={ALL} labels={LABELS} choice={fakeChoice()} />);
    expect(screen.queryByRole("button", { name: "allUp" })).toBeNull();
  });

  it("the tile choice sends TILES_ALL_UP with its record kind", () => {
    const reg = { entity: "test-40-40", all: ALL, defaults: ALL } as unknown as TileRegistry<K>;
    const heard: string[] = [];
    const listen = (e: Event) => heard.push((e as CustomEvent<string>).detail);
    window.addEventListener(TILES_ALL_UP, listen);
    const { result } = renderHook(() => useTileChoice(reg));
    act(() => result.current.allUp());
    window.removeEventListener(TILES_ALL_UP, listen);
    expect(heard).toEqual(["test-40-40"]);
  });

  // Slice 41.02 (Ask first 5): inverted for the home page. Was: „the four record screens draw it; the home page and
  // Setări do not", with `expect(dashboard).not.toMatch(/<TileSelector [^>]*\ballUp\b/)`.
  it("the four record screens and the home page draw it; Setări does not", () => {
    for (const f of [
      ["src", "app", "natural-persons", "_components", "person-detail-tiles.tsx"],
      ["src", "app", "judicial-persons", "_components", "person-detail-tiles.tsx"],
      ["src", "app", "properties", "_components", "property-detail-tiles.tsx"],
      ["src", "app", "documents", "_components", "document-detail-tiles.tsx"],
    ]) {
      expect([f.join("/"), /<TileSelector [^>]*\ballUp\b/.test(read(...f))]).toEqual([f.join("/"), true]);
    }
    const home = read("src", "app", "_components", "dashboard-client.tsx");
    expect(home).toMatch(/<TileSelector [^>]*\ballUp\b/);
    // „Toate sus" needs tiles that have places: the home page's are TileAreas' boxes, under its own entity.
    expect(home).toContain("<TileAreas right={NO_RIGHT} slotRefs={NO_SLOTS} entity={HOME_TILE_REGISTRY.entity}>");
    expect(home).not.toMatch(/<UnitRow\b/);
    expect(read("src", "app", "admin", "settings", "_components", "settings-view.tsx")).not.toMatch(/<TileSelector [^>]*\ballUp\b/);
  });
});
