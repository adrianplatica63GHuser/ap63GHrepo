/**
 * Slice 41.91 — „Închide — <tile>", an X in every tile's corner that „Panouri" can hide (`TileCloseButton`,
 * src/components/tiles/tile-close.tsx): the screen's own untick, through the choice `useTileChoice` registers.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TileCloseButton } from "@/components/tiles/tile-close";
import { TileTitle } from "@/components/tiles/tile-title";
import { tileClosable, tileCloserFor, useTileChoice } from "@/components/tiles/use-tile-choice";
import type { TileRegistry } from "@/lib/ui/tiles";

jest.mock("@/components/tiles/saved-tile-defaults", () => ({ useSavedTileDefaults: () => ({}) }));
// „Închide — {tile}", as messages/ro-RO.json writes it (shared.readEdit.closeTile).
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => (key === "closeTile" ? `Închide — ${values?.tile}` : key),
}));

const REG: TileRegistry<"a" | "b" | "c"> = { entity: "tile-close-test", all: ["a", "b", "c"], defaults: ["a", "b"], form: [] };

function Screen({ edit = null }: { edit?: string | null }) {
  const choice = useTileChoice(REG);
  return (
    <div>
      <button type="button" data-tiles-menu-button="">
        Panouri
      </button>
      <output data-shown="">{choice.shown.join(",")}</output>
      {choice.shown.map((k) => (
        <section key={k} data-tile={k} aria-label={`Tile ${k}`}>
          <TileTitle title={`Tile ${k}`} action={<button type="button">Editează — Tile {k}</button>} close={edit !== k} />
          <TileTitle title={`Second ${k}`} />
        </section>
      ))}
    </div>
  );
}

const wrap = (ui: React.ReactElement) => render(ui);
const flush = async () => {
  await act(async () => {
    jest.advanceTimersByTime(10);
  });
};

describe("41.91 — the tile's X", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => jest.useRealTimers());

  it("on every shown tile, named „Închide — <tile>”, after the tile's „Editează”, and only on its first title", async () => {
    wrap(<Screen />);
    await flush();
    const x = screen.getByRole("button", { name: "Închide — Tile a" });
    expect(x).toHaveAttribute("data-tile-close", "a");
    expect(screen.getAllByRole("button", { name: /^Închide — / })).toHaveLength(2);
    // „Editează" first, then the X, in the title's corner.
    const corner = x.closest("[data-tile-title-action]")!;
    expect([...corner.querySelectorAll("button")].map((b) => b.textContent || b.getAttribute("aria-label"))).toEqual(["Editează — Tile a", "Închide — Tile a"]);
  });

  it("pressing it is the screen's untick: the tile goes, the choice stored; the focus on „Panouri”", async () => {
    wrap(<Screen />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Închide — Tile a" }));
    await flush();
    expect(screen.getByText("b", { selector: "output" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("ga40-tiles-tile-close-test-v1")!)).toEqual(["b"]);
    expect(document.activeElement).toHaveAttribute("data-tiles-menu-button");
  });

  it("the last tile shown has none", async () => {
    wrap(<Screen />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Închide — Tile a" }));
    await flush();
    expect(screen.queryAllByRole("button", { name: /^Închide — / })).toHaveLength(0);
  });

  it("a tile in edit has none", async () => {
    wrap(<Screen edit="a" />);
    await flush();
    expect(screen.queryByRole("button", { name: "Închide — Tile a" })).toBeNull();
    expect(screen.getByRole("button", { name: "Închide — Tile b" })).toBeInTheDocument();
  });

  it("the message is the one ro-RO.json holds", () => {
    const ro = JSON.parse(readFileSync(join(process.cwd(), "messages", "ro-RO.json"), "utf8"));
    const en = JSON.parse(readFileSync(join(process.cwd(), "messages", "en-GB.json"), "utf8"));
    expect(ro.shared.readEdit.closeTile).toBe("Închide — {tile}");
    expect(en.shared.readEdit.closeTile).toBe("Close — {tile}");
  });

  it("with no screen's choice mounted, nothing is drawn — a title anywhere else is as it was", () => {
    const { container } = wrap(
      <section data-tile="a">
        <TileTitle title="Alone" />
        <TileCloseButton tile="a" title="Alone" />
      </section>,
    );
    expect(container.querySelector("[data-tile-title-line]")).toBeNull();
    expect(container.querySelector("[data-tile-close]")).toBeNull();
    expect(tileCloserFor("a")).toBeUndefined();
    expect(tileClosable(undefined, "a")).toBe(false);
  });
});

describe("41.91 — every tile's corner draws it (a guard, so a new tile cannot miss it)", () => {
  const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
  it("TileTitle draws it after its action unless told not to; the screen title, the folded line and the lists' toolbar draw it", () => {
    expect(read("src", "components", "tiles", "tile-title.tsx")).toMatch(/<TileCloseButton title=\{typeof title === "string" \? title : undefined\} firstTitle \/>/);
    expect(read("src", "components", "screen", "tile-title.tsx")).toContain("<TileCloseButton");
    expect(read("src", "components", "tiles", "empty-tile.tsx")).toContain("<TileCloseButton title={title} untitled />");
    expect(read("src", "components", "list", "admin-list.tsx")).toContain("<TileCloseButton />");
  });
  it("a tile that keeps its title's X off draws its own after its buttons — or is a tile in edit", () => {
    const own: Record<string, string> = {
      "src/app/_components/person-tree-tile.tsx": '<TileCloseButton tile="inheritanceTree"',
      "src/components/tiles/interactions-tile.tsx": '<TileCloseButton tile="interactions"',
      "src/app/admin/tags/_components/tag-manager.tsx": '<TileCloseButton tile="cloud"',
    };
    for (const [file, x] of Object.entries(own)) {
      const src = read(...file.split("/"));
      expect([file, src.includes("close={false}")]).toEqual([file, true]);
      expect([file, src.includes(x)]).toEqual([file, true]);
    }
    expect(read("src", "app", "documents", "_components", "pages-panel.tsx")).toContain('{mode !== "peek" && <TileCloseButton tile="pages"');
  });
  it("the four forms' tiles in edit draw none", () => {
    for (const [file, keys] of [
      ["src/app/natural-persons/_components/natural-person-form.tsx", ["identity", "contact"]],
      ["src/app/judicial-persons/_components/judicial-person-form.tsx", ["identity", "contactPersons"]],
      ["src/app/properties/_components/property-form.tsx", ["cadastral", "corners", "address"]],
    ] as const) {
      const src = read(...file.split("/"));
      for (const k of keys) expect([file, k, src.includes(`close={editingTile !== "${k}"}`)]).toEqual([file, k, true]);
    }
    expect(read("src", "app", "documents", "_components", "document-form.tsx")).toContain("close={!framed && !editing}");
    expect(read("src", "components", "tiles", "list-tile.tsx")).toContain("close={!editing}");
  });
});
