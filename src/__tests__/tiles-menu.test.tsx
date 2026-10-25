/**
 * Slice 40.57 — „Panouri": the tile bar behind one button on the four record screens.
 *
 * The button opens and closes the panel; Esc and a press outside close it, a press inside does not; the badge counts
 * the hidden tiles holding a marked field. The panel stays in the page while closed (hidden), so a box keeps its
 * state. The four record screens draw the button right after the version controls and hand the bar the menu; Setări
 * and the home page do not.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";

import { TileSelector } from "@/components/tiles/tile-selector";
import { TilesMenuButton, hiddenMarked, useTilesMenu } from "@/components/tiles/tiles-menu";
import type { TileChoice } from "@/components/tiles/use-tile-choice";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { count?: number }) => (values?.count !== undefined ? `${key}:${values.count}` : key),
}));
jest.mock("@/components/help/help-hint", () => ({ HelpHint: () => null }));

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

type K = "a" | "b" | "c";
const ALL: readonly K[] = ["a", "b", "c"];
const LABELS: Record<K, string> = { a: "Unu", b: "Doi", c: "Trei" };
const choice = (): TileChoice<K> => ({ shown: ["a"], isShown: (k) => k === "a", toggle: jest.fn(), showAll: jest.fn(), reset: jest.fn(), reveal: jest.fn(), allUp: jest.fn() });

function Screen({ badge = 0 }: { badge?: number }) {
  const menu = useTilesMenu();
  return (
    <div>
      <span data-testid="outside">elsewhere</span>
      <TilesMenuButton menu={menu} badge={badge} />
      <TileSelector all={ALL} labels={LABELS} choice={choice()} menu={menu} />
    </div>
  );
}

const panel = () => document.querySelector<HTMLElement>("[data-tiles-panel]")!;
const button = () => screen.getByRole("button", { name: /panels/ });

describe("the „Panouri” button and its panel (40.57)", () => {
  it("closed at first: the panel is in the page, hidden, its boxes keeping their state", () => {
    render(<Screen />);
    expect(button()).toHaveAttribute("aria-expanded", "false");
    expect(button()).toHaveAttribute("aria-controls", panel().id);
    expect(panel().hidden).toBe(true);
    expect(screen.getByRole("checkbox", { name: "Unu", hidden: true })).toBeChecked();
  });

  it("the button opens and closes it; a box ticked inside leaves it open", () => {
    render(<Screen />);
    fireEvent.click(button());
    expect(panel().hidden).toBe(false);
    expect(button()).toHaveAttribute("aria-expanded", "true");
    fireEvent.pointerDown(screen.getByRole("checkbox", { name: "Doi" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Doi" }));
    expect(panel().hidden).toBe(false);
    fireEvent.pointerDown(button());
    fireEvent.click(button());
    expect(panel().hidden).toBe(true);
  });

  it("Esc closes it and gives the focus back to the button; a press outside closes it", () => {
    render(<Screen />);
    fireEvent.click(button());
    screen.getByRole("checkbox", { name: "Doi" }).focus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(panel().hidden).toBe(true);
    expect(document.activeElement).toBe(button());
    fireEvent.click(button());
    expect(panel().hidden).toBe(false);
    fireEvent.pointerDown(screen.getByTestId("outside"));
    expect(panel().hidden).toBe(true);
  });

  it("the badge: a navy count on the corner, described to a screen reader; none at 0", () => {
    const { unmount } = render(<Screen badge={2} />);
    const badge = document.querySelector<HTMLElement>("[data-tiles-menu-badge]")!;
    expect(badge.textContent).toBe("2");
    expect(badge).toHaveAttribute("aria-hidden", "true");
    expect(badge.className).toContain("bg-navy");
    expect(button()).toHaveAccessibleDescription("panelsMarked:2");
    unmount();
    render(<Screen />);
    expect(document.querySelector("[data-tiles-menu-badge]")).toBeNull();
  });

  it("counts the hidden tiles holding a marked field, never one the record cannot show", () => {
    expect(hiddenMarked<K>(["b", "c"], ["a"])).toBe(2);
    expect(hiddenMarked<K>(["a", "b"], ["a"])).toBe(1);
    expect(hiddenMarked<K>(["b", "c"], ["a"], { c: "not for this type" })).toBe(1);
    expect(hiddenMarked<K>([], ["a"])).toBe(0);
  });

  it("useTilesMenu starts closed", () => {
    const { result } = renderHook(() => useTilesMenu());
    expect(result.current.open).toBe(false);
    act(() => result.current.setOpen(true));
    expect(result.current.open).toBe(true);
  });
});

describe("where it is drawn", () => {
  const RECORD = [
    ["src", "app", "natural-persons", "_components", "person-detail-tiles.tsx"],
    ["src", "app", "judicial-persons", "_components", "person-detail-tiles.tsx"],
    ["src", "app", "properties", "_components", "property-detail-tiles.tsx"],
    ["src", "app", "documents", "_components", "document-detail-tiles.tsx"],
  ];

  it.each(RECORD)("%s/%s/%s/%s/%s: the button right after the version controls, the bar given the menu", (...f) => {
    const src = read(...f);
    expect(src).toMatch(/<div ref=\{setNavSlot\} data-version-slot="" className="flex items-center" \/>\s*<TilesMenuButton menu=\{tilesMenu\}/);
    expect(src).toMatch(/<TileSelector [^>]*\bmenu=\{tilesMenu\}/);
    expect(src).toContain("const tilesMenu = useTilesMenu();");
  });

  it("only a Document's button carries a badge — the only record with marked tiles (#37.20)", () => {
    expect(read(...RECORD[3])).toContain("<TilesMenuButton menu={tilesMenu} badge={hiddenMarked(marked, choice.shown)} />");
  });

  it("Setări and the home page keep the open bar", () => {
    expect(read("src", "app", "_components", "dashboard-client.tsx")).not.toMatch(/<TileSelector [^>]*\bmenu=/);
    expect(read("src", "app", "admin", "settings", "_components", "settings-view.tsx")).not.toMatch(/<TileSelector [^>]*\bmenu=/);
  });

  it("„Panouri” / „Panels”, with the badge's sentence in both languages", () => {
    for (const [f, word] of [["ro-RO.json", "Panouri"], ["en-GB.json", "Panels"]]) {
      const tiles = JSON.parse(read("messages", f)).shared.tiles;
      expect(tiles.panels).toBe(word);
      expect(tiles.panelsMarked).toMatch(/^\{count, plural, one \{/);
    }
  });

  it("the e2e helpers open the panel for what they do", () => {
    const helpers = read("e2e", "helpers", "tiles.ts");
    for (const name of ["openTiles", "closeTiles", "pressTileButton", "tilesMenuButton"]) expect(helpers).toContain(`export async function ${name}(`.replace("async function tilesMenuButton", "function tilesMenuButton"));
    expect(helpers).toMatch(/includeHidden: true/);
  });
});
